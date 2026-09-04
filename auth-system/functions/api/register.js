// /api/register (Diagnóstico para error 400 de HubSpot)

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

    // Si tu propio frontend manda datos vacíos, esto activa el 400 local
    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'El correo y la contraseña son obligatorios en el formulario.' }),
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

    // 1. Encriptación nativa SHA-256
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const hubspotHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Boardroom-Portal/1.0'
    };

    // 2. Buscar si el contacto existe
    const searchUrl = 'https://hubapi.com';
    const searchPayload = {
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
      }],
      // Si el error 400 persiste, una de estas propiedades no existe de forma interna en tu HubSpot
      properties: ['password_hash', 'firstname', 'lastname', 'email', 'phone', 'jobtitle', 'company', 'program', 'userstatus']
    };

    const searchRes = await fetch(searchUrl, {
      method: 'POST',
      headers: hubspotHeaders,
      body: JSON.stringify(searchPayload)
    });

    const contentTypeSearch = searchRes.headers.get('content-type') || '';
    if (!contentTypeSearch.includes('application/json')) {
      const textError = await searchRes.text();
      return new Response(
        JSON.stringify({ success: false, message: 'HubSpot devolvió un HTML inválido en la búsqueda.', details: textError.substring(0, 200) }),
        { status: 502, headers: corsHeaders }
      );
    }

    const searchData = await searchRes.json();

    // NUEVA VALIDACIÓN: Si HubSpot responde 400 en la búsqueda, nos dirá el motivo exacto aquí
    if (!searchRes.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `HubSpot rechazó la consulta (Error ${searchRes.status}). Revisa si las propiedades personalizadas existen en el CRM.`, 
          details: searchData 
        }),
        { status: searchRes.status, headers: corsHeaders }
      );
    }

    const existingContact = searchData.results && searchData.results.length > 0 ? searchData.results[0] : null;

    // -------------------------------------------------------------
    // ESCENARIO A: El usuario YA EXISTE en HubSpot
    // -------------------------------------------------------------
    if (existingContact) {
      const currentHash = existingContact.properties?.password_hash;
      const contactId = existingContact.id;

      if (currentHash) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Este correo electrónico ya cuenta con una cuenta activa. Por favor, inicia sesión.' 
          }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Actualizar el contacto existente (inyectar contraseña)
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
        const errData = await updateRes.json();
        return new Response(
          JSON.stringify({ success: false, message: 'Error al actualizar tu cuenta existente en HubSpot.', details: errData }),
          { status: updateRes.status, headers: corsHeaders }
        );
      }

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
      JSON.stringify({ success: false, message: `Error crítico del servidor: ${error.message}` }),
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
