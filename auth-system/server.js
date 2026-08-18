require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const hubspot = require('@hubspot/api-client');
const cors = require('cors');
const path = require('path');

const app = express();
// 1. Servir la carpeta PUBLIC como la raíz de la aplicación web
app.use(express.static(path.join(__dirname, 'public')));

// 2. Servir la carpeta PRIVATE bajo el prefijo '/private'
app.use('/private', express.static(path.join(__dirname, 'private')));

// Redirección opcional: Si alguien entra a la raíz '/', entregar index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// 1. MIDDLEWARES GLOBALES (Deben ir al inicio)
// ==========================================
app.use(express.json());
app.use(cors({
  origin: '*',
  credentials: true
}));

// Inicializar cliente de HubSpot
const hubspotClient = new hubspot.Client({ 
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN 
});

const ROOT_DIR = path.resolve(__dirname, 'public');

// ==========================================
// 2. MIDDLEWARE DE SEGURIDAD PARA ARCHIVOS
// ==========================================
app.use((req, res, next) => {
  const forbiddenFiles = ['/server.js', '/.env', '/package.json', '/package-lock.json'];
  const requestedUrl = req.path.toLowerCase();

  if (
    forbiddenFiles.includes(requestedUrl) || 
    requestedUrl.startsWith('/.') || 
    requestedUrl.endsWith('.env')
  ) {
    return res.status(403).json({ error: 'Acceso prohibido.' });
  }

  next();
});

// ==========================================
// 3. MIDDLEWARE DE AUTENTICACIÓN Y ROLES
// ==========================================
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. No se proporcionó un token.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'clave_secreta_default';
    const decoded = jwt.verify(token, secret);
    req.user = decoded; 
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
}

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado: Permisos insuficientes.' });
    }
    next();
  };
};

// ==========================================
// 4. ARCHIVOS ESTÁTICOS Y RUTA RAÍZ
// ==========================================
// Archivos públicos (CSS, imágenes del login, JS general)
app.use('/public', express.static(ROOT_DIR));
app.use(express.static(ROOT_DIR));

// Vistas/Archivos privados (requieren token)
app.use('/dashboard', verifyToken, express.static(path.join(__dirname, 'private')));

// Ruta raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'login.html'));
});

// ==========================================
// 5. RUTAS PÚBLICAS DE LA API
// ==========================================

// Registro
app.post('/api/register', async (req, res) => {
  const { email, password, firstname, lastname } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'El correo y la contraseña son requeridos.' });
  }

  try {
    try {
      const existingContact = await hubspotClient.crm.contacts.basicApi.getById(
        email, undefined, undefined, undefined, false, 'email'
      );
      if (existingContact) {
        return res.status(400).json({ error: 'El usuario ya se encuentra registrado.' });
      }
    } catch (e) {
      // 404 indica que el contacto no existe; se procede con el registro
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const hubspotResponse = await hubspotClient.crm.contacts.basicApi.create({
      properties: {
        email: email,
        firstname: firstname || '',
        lastname: lastname || '',
        password_hash: hashedPassword,
        user_role: 'cliente'
      }
    });

    if (process.env.ZAPIER_WEBHOOK_REGISTRATION) {
      axios.post(process.env.ZAPIER_WEBHOOK_REGISTRATION, {
        email,
        firstname,
        lastname,
        hubspot_id: hubspotResponse.id,
        created_at: new Date().toISOString()
      }).catch(err => console.error('Error enviando datos a Zapier:', err.message));
    }

    res.status(201).json({ message: 'Usuario registrado exitosamente.' });

  } catch (error) {
    console.error('Error en registro:', error.body || error);
    res.status(500).json({ error: 'Error interno al registrar el usuario.' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos.' });
  }

  try {
    const contact = await hubspotClient.crm.contacts.basicApi.getById(
      email,
      ['email', 'firstname', 'lastname', 'password_hash', 'user_role'],
      undefined, undefined, false, 'email'
    );

    const storedHash = contact.properties.password_hash;
    const userRole = contact.properties.user_role || 'cliente';

    if (!storedHash) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const validPassword = await bcrypt.compare(password, storedHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      { 
        id: contact.id,
        hubspotId: contact.id, 
        email: contact.properties.email, 
        name: contact.properties.firstname,
        role: userRole 
      },
      process.env.JWT_SECRET || 'clave_secreta_default',
      { expiresIn: '2h' }
    );

    res.json({ 
      token, 
      user: { 
        id: contact.id,
        email: contact.properties.email, 
        name: contact.properties.firstname,
        role: userRole 
      } 
    });

  } catch (error) {
    res.status(401).json({ error: 'Usuario no encontrado o credenciales inválidas.' });
  }
});

// ==========================================
// 6. RUTAS PROTEGIDAS DE LA API
// ==========================================

// Obtener perfil del usuario autenticado
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const contactId = req.user.hubspotId || req.user.id;

    const properties = [
      'firstname', 'lastname', 'email', 'phone', 'mobilephone', 'hs_object_id',
      'jobtitle', 'company', 'industry', 'website', 'city', 'state', 'country',
      'lifecyclestage', 'hs_lead_status', 'hubspot_owner_id',
      'programa_inscrito', 'estatus_membresia'
    ];

    const response = await hubspotClient.crm.contacts.basicApi.getById(contactId, properties);

    res.json({
      success: true,
      user: response.properties
    });

  } catch (error) {
    console.error('Error al consultar datos en HubSpot:', error?.body || error.message);
    res.status(500).json({ error: 'No se pudieron obtener los datos del contacto.' });
  }
});

// Actualizar perfil de un contacto en HubSpot
app.put('/api/user/profile/:contactId', verifyToken, async (req, res) => {
  const { contactId } = req.params;
  const { firstname, lastname, phone, jobtitle, company } = req.body;

  if (!contactId) {
    return res.status(400).json({ error: 'Se requiere el ID del contacto de HubSpot.' });
  }

  const propertiesToUpdate = {};
  if (firstname !== undefined) propertiesToUpdate.firstname = firstname;
  if (lastname !== undefined) propertiesToUpdate.lastname = lastname;
  if (phone !== undefined) propertiesToUpdate.phone = phone;
  if (jobtitle !== undefined) propertiesToUpdate.jobtitle = jobtitle;
  if (company !== undefined) propertiesToUpdate.company = company;

  if (Object.keys(propertiesToUpdate).length === 0) {
    return res.status(400).json({ error: 'Debes proporcionar al menos un campo para actualizar.' });
  }

  try {
    const apiResponse = await hubspotClient.crm.contacts.basicApi.update(
      contactId,
      { properties: propertiesToUpdate }
    );

    return res.status(200).json({
      message: 'Perfil actualizado exitosamente en HubSpot.',
      contact: apiResponse,
    });
  } catch (error) {
    console.error('Error al actualizar el perfil en HubSpot:', error?.body || error.message);

    if (error?.code === 404) {
      return res.status(404).json({ error: 'Contacto no encontrado en HubSpot.' });
    }

    return res.status(500).json({
      error: 'Ocurrió un error al intentar actualizar el perfil.',
      details: error?.body?.message || error.message,
    });
  }
});

// Descargar documentos protegidos
app.get('/api/documents/:filename', verifyToken, (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(__dirname, 'protected-uploads', fileName);

  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Archivo no encontrado.' });
    }
  });
});

// Dashboard de administración
app.get('/api/admin/dashboard', verifyToken, authorizeRoles('admin'), (req, res) => {
  res.json({ message: 'Acceso autorizado a la administración.', user: req.user });
});

// ==========================================
// 7. MANEJO DE RUTAS SPA / FALLBACK (Al final de las APIs)
// ==========================================
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'login.html'));
});

// ==========================================
// 8. INICIALIZACIÓN DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
