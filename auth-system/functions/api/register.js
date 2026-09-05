require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');

const app = express();

// ==========================================
// 1. PRIMERA CAPA: MIDDLEWARES CENTRALES
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));
app.enable('trust proxy');

// Consolidación y validación del Token de HubSpot corporativo
const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;

if (!hubspotToken) {
  console.error("ERROR CRÍTICO: No se detectó la variable HUBSPOT_TOKEN ni HUBSPOT_ACCESS_TOKEN en el archivo .env");
}

// Helper de seguridad: Cifrado SHA-256 nativo idéntico y compatible con tu Login
function generateSHA256(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ==========================================
// 2. SEGUNDA CAPA: ENDPOINTS DE LA API (MÁXIMA PRIORIDAD)
// ==========================================

// Endpoint de Registro / Activación de cuentas
app.post('/api/register', async (req, res) => {
  const { email, password, firstname, lastname } = req.body;

  // Validación de seguridad inicial en el servidor
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'El correo electrónico y la contraseña son requeridos.' });
  }

  if (!hubspotToken) {
    return res.status(500).json({ success: false, message: 'Error interno: Base de datos CRM no vinculada en el servidor.' });
  }

  try {
    const hashedPassword = generateSHA256(password);
    const hubspotHeaders = {
      'Authorization': `Bearer ${hubspotToken.trim()}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // INTENTO DIRECTO: Tratar de registrar el contacto en HubSpot
    const createRes = await fetch('https://hubapi.com', {
      method: 'POST',
      headers: hubspotHeaders,
      body: JSON.stringify({
        properties: {
          email: email.trim(),
          firstname: firstname || '',
          lastname: lastname || '',
          password_hash: hashedPassword,
          userstatus: 'Activo'
        }
      })
    });

    // ESCENARIO A: El usuario YA EXISTE en HubSpot (Código 409 Conflict)
    if (createRes.status === 409) {
      // Consultamos el registro existente usando el email como clave alterna en la URL de HubSpot
      const propertiesQuery = 'password_hash,firstname,lastname';
      const getUrl = `https://hubapi.com/${encodeURIComponent(email.trim())}?idProperty=email&properties=${propertiesQuery}`;
      
      const getRes = await fetch(getUrl, { method: 'GET', headers: hubspotHeaders });

      if (getRes.ok) {
        const contactData = await getRes.json();

        // Caso A.1: El usuario ya posee credenciales configuradas
        if (contactData.properties?.password_hash) {
          return res.status(409).json({ 
            success: false, 
            message: 'Este correo electrónico ya cuenta con una cuenta activa en el portal. Intenta iniciar sesión.' 
          });
        }

        // Caso A.2: Existe en la base de datos pero no tiene clave (Actualizamos con PATCH)
        const updateRes = await fetch(`https://hubapi.com/${contactData.id}`, {
          method: 'PATCH',
          headers: hubspotHeaders,
          body: JSON.stringify({
            properties: {
              firstname: firstname || undefined,
              lastname: lastname || undefined,
              password_hash: hashedPassword,
              userstatus: 'Activo'
            }
          })
        });

        if (updateRes.ok) {
          return res.status(200).json({ success: true, message: 'Tu cuenta preexistente ha sido activada con éxito.' });
        }
      }
    }

    // ESCENARIO B: HubSpot rechaza la petición por otra causa (Ej: campos incorrectos)
    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({ message: 'Error de parseo en la respuesta del CRM.' }));
      return res.status(400).json({ 
        success: false, 
        message: 'HubSpot rechazó la inserción del contacto.', 
        details: errData.message 
      });
    }

    // ESCENARIO C: Registro exitoso desde cero (Código 201 Created)
    return res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });

  } catch (error) {
    console.error('Error crítico en endpoint /api/register:', error.message);
    return res.status(500).json({ success: false, message: 'Falla crítica interna en el servidor de Boardroom.' });
  }
});

// Endpoint de Actualización de Perfil Corporativo
app.put('/api/profile/update/:contactId', async (req, res) => {
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
    const response = await fetch(`https://hubapi.com/${contactId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${hubspotToken.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties: propertiesToUpdate })
    });

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: 'HubSpot rechazó la actualización del perfil.' });
    }

    const apiResponse = await response.json();
    return res.status(200).json({
      success: true,
      message: 'Perfil actualizado exitosamente en HubSpot.',
      contact: apiResponse,
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error.message);
    return res.status(500).json({ success: false, error: 'Error interno del servidor al procesar el perfil.' });
  }
});

// Endpoint informativo para consulta de estado de perfil
app.get('/api/profile', (req, res) => {
  return res.json({ success: true, message: 'Microservicio de autenticación activo.' });
});

// ==========================================
// 3. TERCERA CAPA: SERVIR ARCHIVOS ESTÁTICOS
// ==========================================
// Busca y despliega los archivos HTML, CSS y JS dentro de tu carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 4. CUARTA CAPA: FALLBACK COMODÍN (ESTRICTAMENTE AL FINAL)
// ==========================================
// Atrapa cualquier ruta de navegación y sirve el index.html por defecto
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// INTERFAZ DE ARRANQUE DEL SERVIDOR
// ==========================================
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` Servidor de Boardroom activo en el puerto: ${PORT} `);
  console.log(` Interfaz de escucha configurada en: http://0.0.0:${PORT} `);
  console.log(`====================================================`);
});

module.exports = app;
