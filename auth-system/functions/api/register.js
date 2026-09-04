// /api/register (Blindaje absoluto contra errores HTML/JSON de HubSpot en Edge)

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
        JSON.stringify({ success: false, message: 'Error interno: HUBSPOT_TOKEN no configurado en Tencent EdgeOne.' }),
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
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' // Simula navegador para saltar firewalls
    };

    // 2. Intentar crear el contacto directamente
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

    // LEER RESPUESTA COMO TEXTO PRIMERO (Evita el crash del token '<')
    const createRawData = await createRes.text();
    let createData = {};
    
    const contentType = createRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      createData = JSON.parse(createRawData);
    }

    // -------------------------------------------------------------
    // ESCENARIO A: El usuario YA EXISTE en HubSpot (Código 409)
    // -------------------------------------------------------------
    if (createRes.status === 409) {
      let contactId = null;
      const messageText = createData.message || createRawData;
      
      const match = messageText.match(/Existing ID:\s*(\d+)/i);
      if (match && match[1]) {
        contactId = match[1];
      }

      if (!contactId) {
        return new Response(
          JSON.stringify({ success: false, message: 'El correo ya existe, pero no se pudo extraer el ID del conflicto.', raw: messageText.substring(0, 200) }),
          { status: 409, headers: corsHeaders }
        );
      }

      // Validar si posee contraseña (GET)
      const verifyUrl = `https://hubapi.com/${contactId}?properties=password_hash`;
      const verifyRes = await fetch(verifyUrl, { method: 'GET', headers: hubspotHeaders });
      
      if (verifyRes.ok) {
        const verifyRaw = await verifyRes.text();
        if (verifyRes.headers.get('content-type')?.includes('application/json')) {
          const verifyData = JSON.parse(verifyRaw);
          if (verifyData.properties?.password_hash) {
            return new Response(
              JSON.stringify({ success: false, message: 'Este correo electrónico ya cuenta con una cuenta activa. Por favor, inicia sesión.' }),
              { status: 409, headers: corsHeaders }
            );
          }
        }
      }

      // Inyectar contraseña mediante PATCH
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
        const updateErr = await updateRes.text();
        return new Response(
          JSON.stringify({ success: false, message: 'Error al asignar las claves de acceso a la cuenta existente.', debug: updateErr.substring(0, 150) }),
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
    // ESCENARIO B: Error General de HubSpot (No devolvió 201)
    // -------------------------------------------------------------
    if (!createRes.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `HubSpot denegó la operación (Código ${createRes.status}).`, 
          details: createRawData.substring(0, 300) // Te mostrará el texto HTML o JSON del error real
        }),
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
          id: createData.id || 'nuevo',
          firstname: createData.properties?.firstname || firstname,
          lastname: createData.properties?.lastname || lastname,
          email: createData.properties?.email || email,
          userstatus: 'Activo'
        }
      }),
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: `Falla interna crítica en la ejecución: ${error.message}` }),
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
