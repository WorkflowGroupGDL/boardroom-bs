const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Client } = require('@hubspot/api-client');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.enable('trust proxy');

// Inicialización del cliente de HubSpot
const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN || ''
});

// 1. SERVIR ARCHIVOS ESTÁTICOS
// Configura la carpeta 'public' para servir HTML, JS y CSS
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de Verificación JWT para Rutas Protegidas
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Acceso no autorizado. Falta token.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'boardroom_bs_executive_secret_key_2026', (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token inválido o expirado.' });
    }
    req.user = user;
    next();
  });
};

// 2. RUTAS DE LA API (Definidas antes de los fallbacks)

// Endpoint de Autenticación (Login)
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

    // A. Búsqueda en HubSpot
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

    // B. Usuario de Respaldo / Pruebas Locales
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

    // C. Generación del JWT y Respuesta
    if (userVerified) {
      const secret = process.env.JWT_SECRET || 'boardroom_bs_executive_secret_key_2026';
      const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

      const token = jwt.sign(userData, secret, { expiresIn });

      return res.json({
        success: true,
        token: token,
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

// Endpoint Protegido de Perfil para el Dashboard (Coincide con auth-check.js)
app.get('/api/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user,
    profile: req.user
  });
});

// Alias por compatibilidad
app.get('/api/user/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user,
    profile: req.user
  });
});

// 3. ENRUTAMIENTO BASE / FALLBACK
// Redirige la raíz '/' hacia public/index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Captura cualquier ruta no definida y sirve index.html
app.get('/*path', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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