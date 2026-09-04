// /api/register (Diagnóstico absoluto de rechazos de HubSpot)

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
        JSON.stringify({ success: false, message: 'Correo y contraseña requeridos.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const token = env.HUBSPOT_TOKEN;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, message: 'HUBSPOT_TOKEN no definido en variables de entorno.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Hash nativo SHA-256
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // CLAVE: Encabezados estrictos para evitar bloqueos de bots
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
        userstatus: 'Activo',
        password_hash: hashedPassword
      }
    };

    // Petición directa a HubSpot
    const createRes = await fetch('https://hubapi.com', {
      method: 'POST',
      headers: hubspotHeaders,
      body: JSON.stringify(createPayload)
    });

    const createRawData = await createRes.text();

    // SI HUBSPOT RESPONDE ERROR (Cualquiera diferente a 200/201)
    if (!createRes.ok) {
      // Intentar ver si es un JSON de error de HubSpot o un HTML de bloqueo
      let errorDetalle = createRawData;
      if (createRes.headers.get('content-type')?.includes('application/json')) {
        errorDetalle = JSON.parse(createRawData);
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: `HubSpot rechazó la creación del contacto. Código de estado del CRM: ${createRes.status}`,
          diagnostico: errorDetalle
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Si llegó aquí, se guardó con éxito en el CRM
    const createData = JSON.parse(createRawData);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuario registrado con éxito en HubSpot.',
        contact: { id: createData.id, email }
      }),
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: `Falla crítica en Edge: ${error.message}` }),
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
