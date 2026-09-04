// /api/register (Estructura correcta para Cloudflare Pages / Serverless)
import bcrypt from 'bcryptjs'; // Nota: En entornos serverless edge se recomienda bcryptjs

export async function onRequestPost(context) {
  const { request, env } = context;

  // Encabezados CORS obligatorios
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  try {
    const body = await request.json();
    
    // Extracción y limpieza de los datos del formulario
    const email = body.email ? body.email.trim() : '';
    const firstname = body.firstname ? body.firstname.trim() : '';
    const lastname = body.lastname ? body.lastname.trim() : '';
    const password = body.password || '';

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'El correo y la contraseña son requeridos.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const token = env.HUBSPOT_TOKEN;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Error de configuración: HUBSPOT_TOKEN no definido.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 1. Encriptar la contraseña (Generar el Hash)
    // Usamos saltRounds = 10 de forma asíncrona
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. BUSCAR si el contacto ya existe en HubSpot mediante la API de Búsqueda (Search)
    const searchUrl = 'https://hubapi.com';
    const searchPayload = {
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
      }],
      properties: ['password_hash', 'firstname', 'lastname', 'email', 'phone', 'jobtitle', 'company', 'program', 'userstatus']
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

      // Caso A.1: Ya tiene una contraseña asignada
      if (currentHash) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Este correo electrónico ya cuenta con una cuenta activa. Por favor, inicia sesión.' 
          }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Caso A.2: Existe en el CRM pero no tiene contraseña (Actualizamos e inyectamos el Hash)
      const updateUrl = `https://hubapi.com{contactId}`;
      const updatePayload = {
        properties: {
          firstname: firstname || undefined,
          lastname: lastname || undefined,
          userstatus: 'Activo',
          password_hash: hashedPassword
        }
      };

      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      if (!updateRes.ok) {
        const errData = await updateRes.json();
        return new Response(
          JSON.stringify({ success: false, message: 'Error al activar tu cuenta existente.', details: errData }),
          { status: updateRes.status, headers: corsHeaders }
        );
      }

      // Responder con éxito devolviendo el formato de contacto limpio
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Tu cuenta ha sido activada con éxito.',
          contact: {
            id: contactId,
            firstname: existingContact.properties?.firstname || firstname,
            lastname: existingContact.properties?.lastname || lastname,
            email: existingContact.properties?.email || email,
            phone: existingContact.properties?.phone || '',
            jobtitle: existingContact.properties?.jobtitle || '',
            company: existingContact.properties?.company || '',
            program: existingContact.properties?.program || '',
            userstatus: 'Activo'
          }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // -------------------------------------------------------------
    // ESCENARIO B: El usuario NO EXISTE (Registro tradicional nuevo)
    // -------------------------------------------------------------
    const createPayload = {
      properties: {
        email: email,
        firstname: firstname,
        lastname: lastname,
        phone: phone,
        jobtitle: jobtitle,
        company: company,
        program: program,
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

    const createData = await createRes.json();

    if (!createRes.ok) {
      return new Response(
        JSON.stringify({ success: false, message: 'Error al crear la cuenta nueva en HubSpot.', details: createData }),
        { status: createRes.status, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuario registrado con éxito.',
        contact: {
          id: createData.id,
          firstname: createData.properties?.firstname || '',
          lastname: createData.properties?.lastname || '',
          email: createData.properties?.email || email,
          phone: '',
          jobtitle: '',
          company: '',
          program: '',
          userstatus: 'Activo'
        }
      }),
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: `Error del servidor en registro: ${error.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// Soporte obligatorio para peticiones de validación CORS (OPTIONS)
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
