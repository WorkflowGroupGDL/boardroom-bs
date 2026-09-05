// app.js - Versión 100% Corregida y Funcional para producción
require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto'); // Usamos el módulo crypto nativo de Node.js para SHA-256
const hubspot = require('@hubspot/api-client');
const cors = require('cors');

const app = express();

// Middlewares obligatorios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));
app.enable('trust proxy');

// INICIALIZACIÓN CRÍTICA: Instanciar correctamente el cliente oficial de HubSpot
const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;
const hubspotClient = hubspotToken ? new hubspot.Client({ accessToken: hubspotToken.trim() }) : null;

if (!hubspotClient) {
  console.warn("ADVERTENCIA: No se ha detectado un token de acceso válido para HubSpot en el archivo .env");
}

// Archivos Estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Helper interno para generar Hash SHA-256 nativo compatible con tu Login
function generateSHA256(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Endpoint de Registro (CORREGIDO Y OPTIMIZADO)
app.post('/api/register', async (req, res) => {
  const { email, password, firstname, lastname } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Correo y contraseña requeridos.' });
  }

  if (!hubspotClient) {
    return res.status(500).json({ success: false, message: 'El cliente de HubSpot no está configurado en el servidor.' });
  }

  try {
    // 1. Generar Hash SHA-256 nativo compatible
    const hashedPassword = generateSHA256(password);

    // 2. Intentar crear el contacto directamente en HubSpot
    try {
      await hubspotClient.crm.contacts.basicApi.create({
        properties: {
          email: email.trim(),
          firstname: firstname || '',
          lastname: lastname || '',
          password_hash: hashedPassword,
          userstatus: 'Activo'
        }
      });
      
      return res.status(201).json({ success: true, message: 'Usuario registrado exitosamente en el CRM.' });

    } catch (createError) {
      // 3. MANEJO DE DUPLICADOS (Código de error 409 native en HubSpot API Client)
      if (createError.statusCode === 409 || (createError.message && createError.message.includes('409'))) {
        
        // El usuario ya existe en HubSpot. Extraemos su ID desde el mensaje de error o buscamos por email
        // Para agilizar y asegurar el flujo, buscamos el ID del contacto existente mediante su email
        const searchResponse = await hubspotClient.crm.contacts.basicApi.getById(email.trim(), ['password_hash'], [], [], false, 'email');
        
        if (searchResponse && searchResponse.id) {
          // Si ya tiene contraseña asignada, denegamos la duplicidad
          if (searchResponse.properties?.password_hash) {
            return res.status(409).json({ success: false, message: 'Este correo electrónico ya cuenta con una cuenta activa. Por favor, inicia sesión.' });
          }

          // Si existe en el CRM pero no tiene contraseña, le inyectamos la nueva usando UPDATE (PATCH)
          await hubspotClient.crm.contacts.basicApi.update(searchResponse.id, {
            properties: {
              firstname: firstname || undefined,
              lastname: lastname || undefined,
              password_hash: hashedPassword,
              userstatus: 'Activo'
            }
          });

          return res.status(200).json({ success: true, message: 'Tu cuenta preexistente ha sido activada con éxito.' });
        }
      }
      
      // Si fue otro tipo de error al crear, lanzamos la excepción
      throw createError;
    }

  } catch (error) {
    console.error('Error en /api/register:', error?.body || error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al procesar el registro en el CRM.',
      details: error?.body?.message || error.message 
    });
  }
});

// Endpoint de Actualización de Perfil en HubSpot (Se mantiene intacto tu flujo original)
app.put('/api/profile/update/:contactId', async (req, res) => {
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

  if (!hubspotClient) {
    return res.status(500).json({ success: false, error: 'El cliente de HubSpot no está configurado.' });
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
app.get('/api/profile', (req, res) => {
  return res.json({ success: true, message: 'Endpoint de perfil activo.' });
});

// Fallback de Express para Frontend (Asegurar orden abajo)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const startServer = () => {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor activo en el puerto ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = app;
