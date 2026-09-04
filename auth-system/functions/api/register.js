// /api/register (Blindaje absoluto en la lectura del Body)

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  try {
    let email = '';
    let firstname = '';
    let lastname = '';
    let password = '';

    const contentType = request.headers.get('content-type') || '';

    // 1. EXTRACTOR SEGURO: Detectar el tipo de datos que envía el frontend
    if (contentType.includes('application/json')) {
      try {
        const body = await request.json();
        email = body.email || '';
        firstname = body.firstname || '';
        lastname = body.lastname || '';
        password = body.password || '';
      } catch (e) {
        return new Response(
          JSON.stringify({ success: false, message: 'El JSON enviado por el frontend tiene errores de sintaxis.' }),
          { status: 400, headers: corsHeaders }
        );
      }
    } else {
      // Si el formulario se envió de la forma tradicional del navegador
      const formData = await request.formData();
      email = formData.get('email') || '';
      firstname = formData.get('firstname') || '';
      lastname = formData.get('lastname') || '';
      password = formData.get('password') || '';
    }

    // Limpieza de espacios
    email = email.toString().trim();
    firstname = firstname.toString().trim();
    lastname = lastname.toString().trim();
    password = password.toString();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, message: `Datos incompletos recibidos. Email: '${email}', Pass recibido: ${password ? 'SI' : 'NO'}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    const token = env.HUBSPOT_TOKEN;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Falta configurar HUBSPOT_TOKEN en el panel del servidor.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 2. Encriptación nativa SHA-256
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const hubspotHeaders = {
      'Authorization': `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const createPayload = {
      properties: {
        email: email,
        firstname: firstname,
        lastname: lastname,
        password_hash: hashedPassword
      }
    };

    // 3. Envío directo a HubSpot
    const createRes = await fetch('https://hubapi.com', {
      method: 'POST',
      headers: hubspotHeaders,
      body: JSON.stringify(createPayload)
    });

    const createRawData = await createRes.text();
    let createData = {};
    if (createRes.headers.get('content-type')?.includes('application/json')) {
      createData = JSON.parse(createRawData);
    }

    if (!createRes.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `HubSpot rechazó la solicitud. Código: ${createRes.status}`, 
          details: createData.message || createRawData.substring(0, 200) 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuario registrado exitosamente en el CRM.',
        contact: { id: createData.id, email }
      }),
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: `Falla interna post-lectura: ${error.message}` }),
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
