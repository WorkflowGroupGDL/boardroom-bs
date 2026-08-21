const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;

// 1. Middlewares para parsear JSON y servir archivos estáticos
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 2. Endpoint de Login e Integración con HubSpot
app.post('/api/login', async (req, res) => {
  // Desactivar caché explícitamente
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Type', 'application/json');

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'El campo email es obligatorio.'
    });
  }

  try {
    // Consulta a la API de HubSpot desde el Servidor
    const hubspotUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`;
    
    const response = await fetch(hubspotUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const hubspotData = await response.json();

    if (!response.ok) {
      // Manejo cuando el usuario no existe o el token falla
      return res.status(response.status).json({
        success: false,
        message: 'Respuesta de error desde HubSpot',
        error: hubspotData
      });
    }

    // Respuesta exitosa
    return res.status(200).json({
      success: true,
      message: 'Login y sincronización con HubSpot exitosos',
      contact: {
        id: hubspotData.id,
        firstname: hubspotData.properties?.firstname || '',
        lastname: hubspotData.properties?.lastname || '',
        email: hubspotData.properties?.email || email
      }
    });

  } catch (error) {
    console.error('Error interno del servidor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al conectar con los servicios de HubSpot',
      error: error.message
    });
  }
});

// Inicializar Servidor
app.listen(PORT, () => {
  console.log(`Servidor activo y listo en el puerto http://localhost:${PORT}`);
});

// Al final de tu server.js
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor activo en http://localhost:${PORT}`);
  });
}