require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const hubspot = require('@hubspot/api-client');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_JWT_SECRET = 'boardroom_bs_executive_secret_key_2026';
const isServerlessRuntime = !!(
  process.env.VERCEL ||
  process.env.NETLIFY ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.TENCENTCLOUD_RUN_ENV
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: (origin, callback) => {
    const configuredOrigins = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');
    const isAllowed = configuredOrigins.includes('*') || configuredOrigins.includes(normalizedOrigin)
      || configuredOrigins.some(item => item.includes('localhost') && normalizedOrigin.includes(item.replace(/\/$/, '')))
      || ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4173'].includes(normalizedOrigin);

    if (isAllowed || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    return callback(new Error('Origen no autorizado por CORS.'));
  },
  credentials: true
}));

app.use(express.static(PUBLIC_DIR, { index: false }));

const hubspotClient = new hubspot.Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN || ''
});

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Acceso denegado. No se proporcionó un token.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || DEFAULT_JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Token inválido o expirado.' });
  }
}

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

app.get('/api/profile', verifyToken, (req, res) => {
  return res.json({ success: true, user: req.user, profile: req.user });
});

app.get('/*path', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Ruta de API no encontrada.' });
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

if (!isServerlessRuntime) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor activo en el puerto ${PORT}`);
  });
}

module.exports = app;