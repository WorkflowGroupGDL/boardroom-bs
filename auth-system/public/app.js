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

const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;

if (!hubspotToken) {
  console.error("ERROR CRÍTICO: No se detectó la variable HUBSPOT_TOKEN ni HUBSPOT_ACCESS_TOKEN en el archivo .env");
}

function generateSHA256(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ==========================================
// 2. SEGUNDA CAPA: ENDPOINTS DE LA API (MÁXIMA PRIORIDAD)
// ==========================================

// Tu endpoint de login existente se queda aquí arriba intacto y sin tocar.

// Endpoint de Registro / Activación de cuentas (URLs CORREGIDAS)
app.post('/api/register', async (req, res) => {
  const { email, password, firstname, lastname } = req.body;

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

    // CORRECCIÓN: URL de API v3 Oficial de HubSpot
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

    if (createRes.status === 409) {
      // CORRECCIÓN: URL alternativa de consulta por Email para el control de duplicados
      const propertiesQuery = 'password_hash,firstname,lastname';
      const getUrl = `https://hubapi.com/${encodeURIComponent(email.trim())}?idProperty=email&properties=${propertiesQuery}`;
      
      const getRes = await fetch(getUrl, { method: 'GET', headers: hubspotHeaders });

      if (getRes.ok) {
        const contactData = await getRes.json();

        if (contactData.properties?.password_hash) {
          return res.status(409).json({ 
            success: false, 
            message: 'Este correo electrónico ya cuenta con una cuenta activa en el portal. Intenta iniciar sesión.' 
          });
        }

        // CORRECCIÓN: URL de actualización PATCH por ID único de contacto
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

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({ message: 'Error de parseo en la respuesta del CRM.' }));
      return res.status(400).json({ 
        success: false, 
        message: 'HubSpot rechazó la inserción del contacto.', 
        details: errData.message 
      });
    }

    return res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });

  } catch (error) {
    console.error('Error crítico en endpoint /api/register:', error.message);
    return res.status(500).json({ success: false, message: 'Falla crítica interna en el servidor de Boardroom.' });
  }
});

// El resto de tu archivo (profile/update, app.use static, app.get '*') se queda igual...
app.put('/api/profile/update/:contactId', async (req, res) => {
  const { contactId } = req.params;
  const { firstname, lastname, phone, jobtitle, company } = req.body;
  try {
    const response = await fetch(`https://hubapi.com/${contactId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${hubspotToken.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { firstname, lastname, phone, jobtitle, company } })
    });
    const apiResponse = await response.json();
    return res.status(200).json({ success: true, message: 'Perfil actualizado.', contact: apiResponse });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/profile', (req, res) => {
  return res.json({ success: true, message: 'Microservicio de autenticación activo.' });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo en el puerto: ${PORT}`);
});

module.exports = app;
