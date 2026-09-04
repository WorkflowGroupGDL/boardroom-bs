const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

router.post('/register', async (req, res) => {
  try {
    const { email, firstname, lastname, phone, jobtitle, company, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Correo y contraseña son requeridos.' });
    }

    const token = process.env.HUBSPOT_TOKEN;

    // 1. Encriptar la contraseña que el usuario quiere asignar
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 2. BUSCAR si el usuario ya existe en HubSpot y traer su password_hash actual
    const searchUrl = 'https://hubapi.com';
    const searchPayload = {
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'EQ', value: email.trim() }]
      }],
      properties: ['password_hash'] // Le pedimos explícitamente esta propiedad
    };

    const searchRes = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchPayload)
    });

    const searchData = await searchRes.json();
    const existingContact = searchData.results && searchData.results.length > 0 ? searchData.results[0] : null;

    // -------------------------------------------------------------
    // ESCENARIO A: El usuario YA EXISTE en HubSpot
    // -------------------------------------------------------------
    if (existingContact) {
      const currentHash = existingContact.properties?.password_hash;
      const contactId = existingContact.id;

      // Caso A.1: El usuario ya tiene contraseña (Ya está registrado formalmente)
      if (currentHash) {
        return res.status(409).json({ 
          success: false, 
          message: 'Este correo electrónico ya cuenta con una cuenta activa. Por favor, inicia sesión.' 
        });
      }

      // Caso A.2: Existe en el CRM pero NO tiene contraseña (Vamos a actualizarlo)
      const updateUrl = `https://hubapi.com{contactId}`;
      const updatePayload = {
        properties: {
          firstname: firstname?.trim() || undefined, // undefined evita sobreescribir con vacío si ya tenían datos
          lastname: lastname?.trim() || undefined,
          phone: phone?.trim() || undefined,
          jobtitle: jobtitle?.trim() || undefined,
          company: company?.trim() || undefined,
          // program: program?.trim() || undefined,
          userstatus: 'Activo',
          password_hash: hashedPassword // Guardamos su nueva contraseña
        }
      };

      const updateRes = await fetch(updateUrl, {
        method: 'PATCH', // PATCH se usa para actualizar campos específicos en HubSpot
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      if (!updateRes.ok) {
        const errData = await updateRes.json();
        return res.status(updateRes.status).json({ success: false, message: 'Error al actualizar tu cuenta existente.', details: errData });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Tu cuenta ha sido activada con éxito. Ya puedes iniciar sesión.' 
      });
    }

    // -------------------------------------------------------------
    // ESCENARIO B: El usuario NO EXISTE (Registro tradicional nuevo)
    // -------------------------------------------------------------
    const createPayload = {
      properties: {
        email: email.trim(),
        firstname: firstname?.trim() || '',
        lastname: lastname?.trim() || '',
        phone: phone?.trim() || '',
        jobtitle: jobtitle?.trim() || '',
        company: company?.trim() || '',
        // program: program?.trim() || '',
        userstatus: 'Activo',
        password_hash: hashedPassword
      }
    };

    const createRes = await fetch('https://hubapi.com', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createPayload)
    });

    if (!createRes.ok) {
      const errData = await createRes.json();
      return res.status(createRes.status).json({ success: false, message: 'Error al crear la cuenta nueva.', details: errData });
    }

    return res.status(201).json({ 
      success: true, 
      message: 'Usuario registrado con éxito en la plataforma.' 
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
