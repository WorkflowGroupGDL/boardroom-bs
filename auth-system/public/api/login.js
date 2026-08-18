// api/login.js
const jwt = require('jsonwebtoken');
const { Client } = require('@hubspot/api-client');

// Inicializar cliente de HubSpot
const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN || ''
});

// Clave secreta unificada con server.js
const JWT_SECRET = process.env.JWT_SECRET || 'boardroom_bs_executive_secret_key_2026';

module.exports = async (req, res) => {
  // 1. Configuración de cabeceras CORS para peticiones desde el subdominio
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Manejar solicitud preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Validar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    // 3. Garantizar extracción de credenciales (Aun si req.body viene como String)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email, password } = body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Por favor ingresa correo y contraseña.'
      });
    }

    let userVerified = false;
    let userData = null;

    // 4. Búsqueda y Validación en HubSpot
    if (process.env.HUBSPOT_ACCESS_TOKEN) {
      try {
        const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch({
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
        });

        if (searchResponse && searchResponse.results && searchResponse.results.length > 0) {
          userVerified = true;
          const props = searchResponse.results[0].properties;
          userData = {
            id: searchResponse.results[0].id,
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
        console.error('Error consultando API de HubSpot:', hsError.message || hsError);
      }
    }

    // 5. Usuario de Respaldo / Pruebas
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

    // 6. Firma de Token JWT y Respuesta
    if (userVerified) {
      const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
      const token = jwt.sign(userData, JWT_SECRET, { expiresIn });

      return res.status(200).json({
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
    console.error('Error no controlado en login API:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno en el servidor de autenticación.',
      error: error.message
    });
  }
};