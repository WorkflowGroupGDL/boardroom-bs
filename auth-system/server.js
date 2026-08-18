const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Client } = require('@hubspot/api-client');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicialización del cliente de HubSpot
const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN || ''
});

// 1. SERVIR ARCHIVOS ESTÁTICOS DESDE PUBLIC
app.use(express.static(path.join(__dirname, 'public')));

// 2. MIDDLEWARE DE VERIFICACIÓN DE TOKEN
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Acceso no autorizado. Falta token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'boardroom_bs_executive_secret_key_2026';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Token inválido o expirado.' });
  }
}

// 3. RUTAS DE LA API

// Endpoint: Registro
app.post('/api/register', async (req, res) => {
  const { email, password, firstname, lastname } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Ingresa correo y contraseña.' });
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
      return res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });
    } else {
      return res.status(201).json({ success: true, message: 'Registro simulado en modo local.' });
    }
  } catch (error) {
    console.error('Error en /api/register:', error?.body || error);
    return res.status(500).json({ success: false, message: 'Error interno al registrar usuario.' });
  }
});

// Endpoint: Autenticación / Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Por favor ingresa correo y contraseña.' });
  }

  try {
    let userData = null;

    if (process.env.HUBSPOT_ACCESS_TOKEN) {
      const searchFilter = {
        filterGroups: [{
          filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
        }],
        properties: ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'programa_inscrito', 'hs_lead_status']
      };

      const hubspotResponse = await hubspotClient.crm.contacts.searchApi.doSearch(searchFilter);

      if (hubspotResponse.results && hubspotResponse.results.length > 0) {
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
    }

    // Usuario de respaldo local
    if (!userData && email === 'admin@boardroom.com' && password === '123456') {
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

    if (userData) {
      const secret = process.env.JWT_SECRET || 'boardroom_bs_executive_secret_key_2026';
      const token = jwt.sign(userData, secret, { expiresIn: '8h' });

      return res.json({
        success: true,
        token: token,
        redirectUrl: '/dashboard.html',
        user: userData
      });
    }

    return res.status(401).json({ success: false, message: 'Usuario no encontrado o credenciales inválidas.' });

  } catch (error) {
    console.error('Error en /api/login:', error);
    return res.status(500).json({ success: false, message: 'Error interno en el servidor de autenticación.' });
  }
});

// Endpoint: Obtener Perfil (Sincronizado con auth-check.js)
app.get('/api/profile', verifyToken, (req, res) => {
  return res.json({ success: true, user: req.user });
});

// Endpoint alternativo de compatibilidad
app.get('/api/user/profile', verifyToken, (req, res) => {
  return res.json({ success: true, profile: req.user, user: req.user });
});

// Fallback de SPA / Enrutamiento Nginx
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de Boardroom Business School corriendo en puerto ${PORT}`);
});