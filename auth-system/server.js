const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Client } = require('@hubspot/api-client');
require('dotenv').config();

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

app.use(cors({
  origin: (origin, callback) => {
    const configuredOrigins = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/$/, '');
    const isAllowed = configuredOrigins.includes('*') || configuredOrigins.includes(normalizedOrigin)
      || configuredOrigins.some(item => item.includes('localhost') && normalizedOrigin.includes(item.replace(/\/$/, '')))
      || ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4173'].includes(normalizedOrigin);

    if (isAllowed) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    return callback(new Error('Origen no autorizado por CORS.'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN || ''
});

app.use(express.static(PUBLIC_DIR, { index: false }));

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Acceso no autorizado. Falta token.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || DEFAULT_JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token inválido o expirado.' });
    }
    req.user = user;
    next();
  });
};

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Por favor ingresa correo y contraseña.'
    });
  }

  try {
    let userVerified = false;
    let userData = null;

    if (process.env.HUBSPOT_ACCESS_TOKEN) {
      try {
        const PublicObjectSearchRequest = {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'email',
                  operator: 'EQ',
                  value: email
                }
              ]
            }
          ],
          properties: ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'programa_inscrito', 'hs_lead_status']
        };

        const hubspotResponse = await hubspotClient.crm.contacts.searchApi.doSearch(PublicObjectSearchRequest);

        if (hubspotResponse && hubspotResponse.results && hubspotResponse.results.length > 0) {
          userVerified = true;
          const props = hubspotResponse.results[0].properties;
          userData = {
            id: hubspotResponse.results[0].id,
            email: props.email,
            firstname: props.firstname || '',
            lastname: props.lastname || '',
            phone: props.phone || '',
            company: props.company || '',
            jobtitle: props.jobtitle || '',
            programa_inscrito: props.programa_inscrito || 'Programa Ejecutivo',
            hs_lead_status: props.hs_lead_status || 'Activo'
          };
        }
      } catch (hsError) {
        console.error('Error al consultar la API de HubSpot:', hsError.message || hsError);
      }
    }

    if (!userVerified && email === 'admin@boardroom.com' && password === '123456') {
      userVerified = true;
      userData = {
        id: 'mock-123',
        email: 'admin@boardroom.com',
        firstname: 'James',
        lastname: 'Lass',
        phone: '+52 33 1064 6668',
        company: 'Boardroom Business School',
        jobtitle: 'Director Ejecutivo',
        programa_inscrito: 'Programa Alta Dirección',
        hs_lead_status: 'Activo'
      };
    }

    if (userVerified) {
      const secret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
      const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
      const token = jwt.sign(userData, secret, { expiresIn });

      return res.json({
        success: true,
        token,
        redirectUrl: '/dashboard.html',
        user: userData
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Usuario no encontrado o credenciales inválidas.'
    });
  } catch (error) {
    console.error('Error no controlado en /api/login:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno en el servidor de autenticación.',
      error: error.message
    });
  }
});

app.get('/api/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user,
    profile: req.user
  });
});

app.get('/api/user/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user,
    profile: req.user
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/*path', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Ruta de API no encontrada.' });
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

if (!isServerlessRuntime) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de Boardroom Business School activo en el puerto ${PORT}`);
  });
}

module.exports = app;