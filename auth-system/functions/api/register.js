// /api/register (Código final optimizado para Cloudflare & HubSpot)

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  try {
    const body = await request.json();
    
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
        JSON.stringify({ success: false, message: 'Error interno: El token de acceso a la base de datos no está configurado.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 1. Encriptación nativa SHA-256
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const hubspotHeaders = {
      'Authorization': `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // 2. BUSCAR AL CONTACTO (Usando el endpoint GET ultra estable por propiedad de email)
    const propertiesNeeded = ['password_hash', 'firstname', 'lastname', 'email', 'phone', 'jobtitle', 'company', 'program', 'userstatus'];
    const propertiesQuery = propertiesNeeded.join(',');
    
    const searchUrl = `https://hubapi.com{encodeURIComponent(email)}?idProperty=email&properties=${propertiesQuery}`;
    
    const searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers: hubspotHeaders
    });

    let existingContact = null;

    // Si responde 200 significa que el usuario ya existe en HubSpot
    if (searchRes.ok) {
      existingContact = await searchRes.json();
    } 
    // Si da un error diferente a 404 (Contacto no encontrado), capturamos el fallo técnico
    else if (searchRes.status !== 404) {
      const errText = await searchRes.text();
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `HubSpot denegó la consulta de validación (Código ${searchRes.status}).`, 
          details: errText.substring(0, 300) 
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    // -------------------------------------------------------------
    // ESCENARIO A: El usuario YA EXISTE en HubSpot
    // -------------------------------------------------------------
    if (existingContact) {
      const currentHash = existingContact.properties?.password_hash;
      const contactId = existingContact.id;

      // Caso A.1: El usuario ya tiene una contraseña asignada
      if (currentHash) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Este correo electrónico ya cuenta con una cuenta activa. Por favor, inicia sesión.' 
          }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Caso A.2: Existe pero no tiene contraseña (Lo actualizamos usando PATCH)
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
        headers: hubspotHeaders,
        body: JSON.stringify(updatePayload)
      });

      if (!updateRes.ok) {
        const errData = await updateRes.text();
        return new Response(
          JSON.stringify({ success: false, message: 'Error al inyectar las credenciales en tu cuenta existente.', details: errData.substring(0, 200) }),
          { status: updateRes.status, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Tu cuenta preexistente ha sido activada con éxito.',
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
    // ESCENARIO B: El usuario NO EXISTE (Registro nuevo desde cero)
    // -------------------------------------------------------------
    const createPayload = {
      properties: {
        email: email,
        firstname: firstname,
        lastname: lastname,
        userstatus: 'Activo',
        password_hash: hashedPassword
      }
    };

    const createRes = await fetch('https://hubapi.com', {
      method: 'POST',
      headers: hubspotHeaders,
      body: JSON.stringify(createPayload)
    });

    const createData = await createRes.json();

    if (!createRes.ok) {
      return new Response(
        JSON.stringify({ success: false, message: 'HubSpot rechazó la creación del nuevo contacto.', details: createData }),
        { status: createRes.status, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuario registrado exitosamente.',
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
      JSON.stringify({ success: false, message: `Error crítico en el servidor backend: ${error.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }
}

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
