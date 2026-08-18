// api/login.js
const jwt = require('jsonwebtoken');
const { Client } = require('@hubspot/api-client');

const hubspotClient = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN || ''
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const { email, password } = req.body;

  // ... (Misma lógica de validación de HubSpot / Usuario de respaldo) ...

  const token = jwt.sign(userData, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });

  return res.status(200).json({
    success: true,
    token: token,
    redirectUrl: '/dashboard.html',
    user: userData
  });
};