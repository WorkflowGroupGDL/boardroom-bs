// /api/register (Versión optimizada contra bloqueos WAF de Tencent EdgeOne)

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
        JSON.stringify({ success: false, message: 'Error interno: HUBSPOT_TOKEN no configurado en EdgeOne.' }),
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

    // 2. PASO DIRECTO: Intentar crear el contacto de forma limpia (Evita bloqueos de URL en EdgeOne)
    const createUrl = 'https://hubapi.com';
    const createPayload = {
      properties: {
        email: email,
        firstname: firstname,
        lastname: lastname,
        userstatus: 'Activo',
        password_hash: hashedPassword
      }
    };

    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: hubspotHeaders,
      body: JSON.stringify(createPayload)
    });

    const createData = await createRes.json();

    // -------------------------------------------------------------
    // ESCENARIO A: El usuario YA EXISTE en HubSpot (Código 409 Conflict)
    // -------------------------------------------------------------
    if (createRes.status === 409) {
      // HubSpot en el error 409 nos devuelve de forma nativa el ID del contacto existente
      // El formato del error de duplicados es: details: [ { message: 'Contact already exists. Existing ID: 12345' } ]
      let contactId = null;
      if (createData.message) {
        const match = createData.message.match(/Existing ID:\s*(\d+)/i);
        if (match && match[1]) contactId = match[1];
      }

      if (!contactId) {
        return new Response(
          JSON.stringify({ success: false, message: 'El correo ya está registrado en la base de datos, pero no se pudo recuperar el identificador.' }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Validar si la cuenta preexistente ya tiene una contraseña (Haciendo un GET corto al ID)
      const verifyUrl = `https://hubapi.com/${contactId}?properties=password_hash`;
      const verifyRes = await fetch(verifyUrl, { method: 'GET', headers: hubspotHeaders });
      
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        if (verifyData.properties?.password_hash) {
          return new Response(
            JSON.stringify({ success: false, message: 'Este correo electrónico ya cuenta con una cuenta activa. Por favor, inicia sesión.' }),
            { status: 409, headers: corsHeaders }
          );
        }
      }

      // Si no tiene contraseña, procedemos a activarlo inyectando el Hash mediante PATCH
      const updateUrl = `https://hubapi.com/${contactId}`;
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
        return new Response(
          JSON.stringify({ success: false, message: 'Error al asignar las credenciales de acceso a tu cuenta existente.' }),
          { status: updateRes.status, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Tu cuenta preexistente ha sido activada con éxito.',
          contact: { id: contactId, firstname, lastname, email, userstatus: 'Activo' }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // -------------------------------------------------------------
    // ESCENARIO B: Error General controlado de HubSpot
    // -------------------------------------------------------------
    if (!createRes.ok) {
      return new Response(
        JSON.stringify({ success: false, message: 'HubSpot rechazó la solicitud de registro.', details: createData }),
        { status: createRes.status, headers: corsHeaders }
      );
    }

    // -------------------------------------------------------------
    // ESCENARIO C: Registro exitoso desde cero (Código 201 Created)
    // -------------------------------------------------------------
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuario registrado exitosamente.',
        contact: {
          id: createData.id,
          firstname: createData.properties?.firstname || '',
          lastname: createData.properties?.lastname || '',
          email: createData.properties?.email || email,
          userstatus: 'Activo'
        }
      }),
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: `Error crítico en la infraestructura Edge: ${error.message}` }),
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
