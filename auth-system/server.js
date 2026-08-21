require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Client } = require('@hubspot/api-client');

const app = express();
// Reemplaza por tu Token de Aplicación Privada de HubSpot
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

// ==========================================
// 1. MIDDLEWARES BASE Y PARSERS (PRIMERO)
// ==========================================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.enable('trust proxy');


// Diagnóstico de entrada: Loggear todas las peticiones entrantes
app.use((req, res, next) => {
  console.log(`[REQUEST RECEIVED] Method: ${req.method} | URL: ${req.url} | OriginalUrl: ${req.originalUrl}`);
  next();
});

// Inicialización del cliente de HubSpot
const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN || ''
});

// ==========================================
// 2. NORMALIZADOR DE RUTAS DE TENCENT GATEWAY
// ==========================================
app.use((req, res, next) => {
  // Reescribir la URL si Tencent Gateway o el proxy le anteponen prefijos
  if ((req.url.endsWith('/api/login') || req.originalUrl?.endsWith('/api/login')) && req.method === 'POST') {
    req.url = '/api/login';
  }
  if ((req.url.endsWith('/api/register') || req.originalUrl?.endsWith('/api/register')) && req.method === 'POST') {
    req.url = '/api/register';
  }
  next();
});

// Middleware de Verificación JWT para Rutas Protegidas
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Acceso no autorizado. Falta token.' });
  }

  const secret = process.env.JWT_SECRET || 'boardroom_bs_executive_secret_key_2026';
  jwt.verify(token, secret, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token inválido o expirado.' });
    }
    req.user = user;
    next();
  });
};

// ==========================================
// 3. RUTAS API DINÁMICAS (SEGUNDO)
// ==========================================

// 1. Endpoint de Autenticación (Login)
app.post('/api/login', async (req, res) => {
  // 1. Evitar que la respuesta sea almacenada en caché
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/json');

  const { email, password } = req.body;

  try {
    // 2. Aquí va tu validación actual de contraseña / base de datos
    // const usuarioValido = await validarUsuario(email, password);

    // 3. AQUÍ INTEGRAS LA COMUNICACIÓN CON HUBSPOT
    const hubspotRes = await axios.get(
      `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`,
      {
        headers: {
          Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // 4. Responder al cliente en formato JSON
    return res.status(200).json({
      success: true,
      message: 'Login correcto',
      contactId: hubspotRes.data.id
    });

  } catch (error) {
    console.error('Error HubSpot:', error.response?.data || error.message);
    
    // Responder en JSON aunque falle la consulta a HubSpot
    return res.status(200).json({
      success: true,
      message: 'Login correcto (sin datos de HubSpot)'
    });
  }
});

// 2. Endpoint de Registro
app.post('/api/register', async (req, res) => {
  const { email, password, firstname, lastname } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Correo y contraseña requeridos.' });
  }

  try {
    if (process.env.HUBSPOT_ACCESS_TOKEN) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await hubspotClient.crm.contacts.basicApi.create({
        properties: {
          email,
          firstname: firstname || '',
          lastname: lastname || '',
          password_hash: hashedPassword
        }
      });
    }
    return res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });
  } catch (error) {
    console.error('Error en /api/register:', error?.body || error.message);
    return res.status(500).json({ success: false, message: 'Error al registrar el contacto.' });
  }
});

// 3. Endpoint de Actualización de Perfil
app.put('/api/profile/update/:contactId', verifyToken, async (req, res) => {
  const { contactId } = req.params;
  const { firstname, lastname, phone, jobtitle, company } = req.body;

  if (!contactId) {
    return res.status(400).json({ success: false, error: 'Se requiere el ID del contacto de HubSpot.' });
  }

  const propertiesToUpdate = {};
  if (firstname !== undefined) propertiesToUpdate.firstname = firstname;
  if (lastname !== undefined) propertiesToUpdate.lastname = lastname;
  if (phone !== undefined) propertiesToUpdate.phone = phone;
  if (jobtitle !== undefined) propertiesToUpdate.jobtitle = jobtitle;
  if (company !== undefined) propertiesToUpdate.company = company;

  if (Object.keys(propertiesToUpdate).length === 0) {
    return res.status(400).json({ success: false, error: 'Debes proporcionar al menos un campo para actualizar.' });
  }

  try {
    const apiResponse = await hubspotClient.crm.contacts.basicApi.update(
      contactId,
      { properties: propertiesToUpdate }
    );

    return res.status(200).json({
      success: true,
      message: 'Perfil actualizado exitosamente en HubSpot.',
      contact: apiResponse,
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error?.body || error.message);
    return res.status(500).json({ success: false, error: 'Error al actualizar en el CRM.' });
  }
});

// 4. Endpoints de Consulta de Perfil
app.get('/api/profile', verifyToken, (req, res) => {
  res.json({ success: true, user: req.user, profile: req.user });
});

app.get('/api/user/profile', verifyToken, (req, res) => {
  res.json({ success: true, user: req.user, profile: req.user });
});

// ==========================================
// 4. ARCHIVOS ESTÁTICOS Y FALLBACK (TERCERO)
// ==========================================

// Servir activos de la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Enrutamiento SPA/Fallback HTML (Excluye expresamente cualquier llamada /api/)
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// 5. INICIALIZACIÓN DEL SERVIDOR
// ==========================================
const startServer = () => {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de Boardroom Business School activo en el puerto ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = app;