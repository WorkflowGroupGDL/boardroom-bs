require('dotenv').config();
const express = require('express');
const path = require('path');
const hubspot = require('@hubspot/api-client');
const bcrypt = require('bcrypt');

const app = express();

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar HubSpot
const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

// --- RUTA: REGISTRO DE USUARIOS ---
app.post('/api/register', async (req, res) => {
  const { email, password, firstname, lastname } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email y contraseña requeridos.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const properties = {
      email: email,
      firstname: firstname || '',
      lastname: lastname || '',
      password_hash: hashedPassword 
    };

    const apiResponse = await hubspotClient.crm.contacts.basicApi.create({ properties });
    
    return res.status(201).json({ success: true, message: 'Usuario registrado con éxito.', id: apiResponse.id });
  } catch (error) {
    console.error('Error en registro:', error.body || error);
    return res.status(400).json({ success: false, message: 'El correo ya existe o faltan configurar propiedades en HubSpot.' });
  }
});

// --- RUTA: INICIO DE SESIÓN ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email y contraseña requeridos.' });
  }

  try {
    const searchRequest = {
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
      }],
      properties: ['email', 'password_hash', 'firstname'],
      limit: 1
    };

    const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch(searchRequest);

    if (searchResponse.results.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas.' });
    }

    const contact = searchResponse.results[0];
    const savedPasswordHash = contact.properties.password_hash;

    if (!savedPasswordHash) {
      return res.status(401).json({ success: false, message: 'El usuario no tiene una contraseña registrada.' });
    }

    const match = await bcrypt.compare(password, savedPasswordHash);

    if (!match) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas.' });
    }

    return res.status(200).json({
      success: true,
      message: `¡Bienvenido, ${contact.properties.firstname || 'Usuario'}!`,
      user: { id: contact.id, email: contact.properties.email }
    });

  } catch (error) {
    console.error('Error en login:', error.body || error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

// Redirección por defecto al frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
