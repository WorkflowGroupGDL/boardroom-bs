required('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');

const app = express();

// 1. PRIMERA CAPA: MIDDLEWARES CENTRALES
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));
app.enable('trust proxy');

const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;

function generateSHA256(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// =================================================================
// 2. SEGUNDA CAPA: EL LOGIN (Colócalo aquí, justo arriba del registro)
// =================================================================
// DEJA AQUÍ TU CÓDIGO DE LOGIN INTACTO (No lo toques, ya que funciona perfectamente)


// =================================================================
// 3. TERCERA CAPA: EL NUEVO ENDPOINT DE REGISTRO BLINDADO
// =================================================================
app.post('/api/register', async (req, res) => {
  const { email, password, firstname, lastname } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'El correo electrónico y la contraseña son requeridos.' });
  }

  if (!hubspotToken) {
    return res.status(500).json({ success: false, message: 'Error interno: Token de HubSpot no configurado.' });
  }

  try {
    const hashedPassword = generateSHA256(password);
    const hubspotHeaders = {
      'Authorization': `Bearer ${hubspotToken.trim()}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // 1. Intentar crear el contacto directamente en HubSpot (URL CORREGIDA)
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

    // 2. Manejo de duplicados (Código 409 Conflict)
    if (createRes.status === 409) {
      const propertiesQuery = 'password_hash,firstname,lastname';
      const getUrl = `https://hubapi.com/${encodeURIComponent(email.trim())}?idProperty=email&properties=${propertiesQuery}`;
      
      const getRes = await fetch(getUrl, { method: 'GET', headers: hubspotHeaders });

      if (getRes.ok) {
        const contactData = await getRes.json();

        if (contactData.properties?.password_hash) {
          return res.status(409).json({ 
            success: false, 
            message: 'Este correo electrónico ya cuenta con una cuenta activa. Por favor, inicia sesión.' 
          });
        }

        // Si existe en el CRM pero no tiene contraseña, la inyectamos usando PATCH
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
      const errData = await createRes.json().catch(() => ({ message: 'Error de parseo en HubSpot.' }));
      return res.status(400).json({ success: false, message: 'HubSpot rechazó la inserción.', details: errData.message });
    }

    return res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });

  } catch (error) {
    console.error('Error crítico en endpoint /api/register:', error.message);
    return res.status(500).json({ success: false, message: 'Falla crítica interna en el servidor.' });
  }
});


// =================================================================
// 4. CUARTA CAPA: ARCHIVOS ESTÁTICOS (DEBE IR ABAJO DE LA API)
// =================================================================
app.use(express.static(path.join(__dirname, 'public')));


// =================================================================
// 5. QUINTA CAPA: COMODÍN FALLBACK (ESTRICTAMENTE AL FINAL DE TODO)
// =================================================================
// Esto asegura que Express solo responda HTML si la ruta no coincide con el login o el registro
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Levantar el servidor
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo en el puerto: ${PORT}`);
});

module.exports = app;
