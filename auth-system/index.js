require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const hubspot = require('@hubspot/api-client');
const cors = require('cors');

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*', credentials: true }));

// Archivos Estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar cliente de HubSpot
const hubspotClient = new hubspot.Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN || ''
});

// Middleware de Autenticación JWT
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Acceso denegado. No se proporcionó un token.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'boardroom_bs_executive_secret_key_2026';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Token inválido o expirado.' });
  }
}

// Endpoint de Registro
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

// Endpoint de Actualización de Perfil en HubSpot
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

// Endpoint de Consulta de Perfil
app.get('/api/profile', verifyToken, (req, res) => {
  return res.json({ success: true, user: req.user, profile: req.user });
});

// Fallback de Express 5 para Frontend
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});