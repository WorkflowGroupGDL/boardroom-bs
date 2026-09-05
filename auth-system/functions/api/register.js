// app.js (100% Blindado con Fetch nativo para HubSpot)
require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');

const app = express();

// Middlewares obligatorios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));
app.enable('trust proxy');

// Variables de entorno consolidadas
const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;

// Archivos Estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Helper para cifrado SHA-256 nativo compatible con tu Login
function generateSHA256(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Endpoint de Registro Blindado contra caídas HTML
app.post('/api/register', async (req, res) => {
  const { email, password, firstname, lastname } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Correo y contraseña requeridos.' });
  }

  if (!hubspotToken) {
    return res.status(500).json({ success: false, message: 'Falta configurar las credenciales de HubSpot en el archivo .env.' });
  }

  try {
    const hashedPassword = generateSHA256(password);
    const hubspotHeaders = {
      'Authorization': `Bearer ${hubspotToken.trim()}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // 1. INTENTAR CREAR EL CONTACTO DIRECTAMENTE (Flujo optimizado para velocidad)
    const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
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

    // 2. CONTROL DE DUPLICADOS (Código 409 Conflict)
    if (createRes.status === 409) {
      // El usuario ya existe. Hacemos un GET limpio usando el correo directo en la URL
      const propertiesQuery = 'password_hash,firstname,lastname';
      const getUrl = `https://api.hubapi.com/${encodeURIComponent(email.trim())}?idProperty=email&properties=${propertiesQuery}`;
      
      const getRes = await fetch(getUrl, { method: 'GET', headers: hubspotHeaders });

      if (getRes.ok) {
        const contactData = await getRes.json();

        // Si el usuario ya cuenta con una contraseña guardada en el CRM
        if (contactData.properties?.password_hash) {
          return res.status(409).json({ 
            success: false, 
            message: 'Este correo electrónico ya cuenta con una cuenta activa. Por favor, inicia sesión.' 
          });
        }

        // Si existe pero no tiene contraseña, inyectamos la contraseña usando PATCH directo al ID numérico
        const updateRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactData.id}`, {
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

    // 3. Control de errores generales controlados de HubSpot
    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({ message: 'Error de formato en HubSpot' }));
      return res.status(400).json({ 
        success: false, 
        message: 'HubSpot rechazó la inserción del contacto.', 
        details: errData.message 
      });
    }

    return res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });

  } catch (error) {
    console.error('Error crítico en backend /api/register:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Falla crítica interna al procesar el registro.',
      error: error.message 
    });
  }
});

// Endpoint de Actualización de Perfil (Manteniendo tu estructura)
app.put('/api/profile/update/:contactId', async (req, res) => {
  const { contactId } = req.params;
  const { firstname, lastname, phone, jobtitle, company } = req.body;

  if (!contactId) {
    return res.status(400).json({ success: false, error: 'Se requiere el ID del contacto.' });
  }

  const propertiesToUpdate = {};
  if (firstname !== undefined) propertiesToUpdate.firstname = firstname;
  if (lastname !== undefined) propertiesToUpdate.lastname = lastname;
  if (phone !== undefined) propertiesToUpdate.phone = phone;
  if (jobtitle !== undefined) propertiesToUpdate.jobtitle = jobtitle;
  if (company !== undefined) propertiesToUpdate.company = company;

  try {
    const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${hubspotToken.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties: propertiesToUpdate })
    });

    if (!response.ok) throw new Error('Error al actualizar en CRM');
    const apiResponse = await response.json();

    return res.status(200).json({
      success: true,
      message: 'Perfil actualizado exitosamente en HubSpot.',
      contact: apiResponse,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/profile', (req, res) => {
  return res.json({ success: true, message: 'Endpoint activo.' });
});

// Fallback de archivos estáticos
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => {
  console.log(`Servidor corriendo.`);
});
