const express = require('express');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
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

// 1. SERVIR ARCHIVOS ESTÁTICOS
// Configura la carpeta 'public' para servir HTML, JS y CSS
app.use(express.static(path.join(__dirname, 'public')));

// 2. RUTAS DE LA API (Definidas antes de los fallbacks)

// Endpoint de Autenticación
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

    // A. Búsqueda y Verificación en HubSpot (si existe el token)
    if (process.env.HUBSPOT_ACCESS_TOKEN) {
      const searchFilter = {
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
        properties: ['firstname', 'lastname', 'email', 'programa_inscrito', 'estado_de_cuenta']
      };

      const hubspotResponse = await hubspotClient.crm.contacts.searchApi.doSearch(searchFilter);

      if (hubspotResponse.results && hubspotResponse.results.length > 0) {
        userVerified = true;
        const props = hubspotResponse.results[0].properties;
        userData = {
          email: props.email,
          nombre: props.firstname || '',
          apellido: props.lastname || '',
          programa: props.programa_inscrito || 'Ejecutivo',
          estadoCuenta: props.estado_de_cuenta || 'Al día'
        };
      }
    }

    // B. Usuario de Respaldo / Pruebas Locales
    if (!userVerified && email === 'admin@boardroom.com' && password === '123456') {
      userVerified = true;
      userData = {
        email: 'admin@boardroom.com',
        nombre: 'James',
        apellido: 'Lass',
        programa: 'Programa Alta Dirección',
        estadoCuenta: 'Al día'
      };
    }

    // C. Respuesta según el resultado de la validación
    if (userVerified) {
      const secret = process.env.JWT_SECRET || 'boardroom_bs_executive_secret_key_2026';
      const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

      // Firma del Token JWT
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
    console.error('Error en /api/login:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno en el servidor de autenticación.'
    });
  }
});

// Endpoint Protegido de Perfil para el Dashboard
app.get('/api/user/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Acceso no autorizado. Falta token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'boardroom_bs_executive_secret_key_2026'
    );
    return res.json({ success: true, profile: decoded });
  } catch (err) {
    return res.status(403).json({ message: 'Token inválido o expirado.' });
  }
});

// 3. ENRUTAMIENTO BASE / FALLBACK
// Redirige la raíz '/' hacia public/index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Captura cualquier otra ruta estática no encontrada y sirve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configuración de Puerto para Tencent Cloud / Entorno Local
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de Boardroom Business School activo en el puerto ${PORT}`);
});