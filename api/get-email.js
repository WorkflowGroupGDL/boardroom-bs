// api/register.js - Lógica idéntica a tu archivo de Login funcional

export async function onRequestPost(context) {
  const { request, env } = context;

  // Encabezados CORS idénticos a los de tu login activo
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  try {
    const body = await request.json();
    const email = body.email ? body.email.trim() : '';
    const password = body.password || '';

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'El correo electrónico y la contraseña son requeridos.' }),
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

    // 1. Encriptación nativa SHA-256 (Compatible con Edge)
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const hubspotHeaders = {
      'Authorization': `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // 2. CONSULTA IDÉNTICA AL LOGIN: Usamos el GET por email directo que ya sabes que funciona
    const propertiesQuery = 'password_hash,firstname,lastname,email,phone,jobtitle,company,program,userstatus';
    const hubspotUrl = `https://hubapi.com{encodeURIComponent(email)}?idProperty=email&properties=${propertiesQuery}`;
    
    const hubspotRes = await fetch(hubspotUrl, {
      method: 'GET',
      headers: hubspotHeaders
    });

    // Si el correo no existe en el sistema
    if (hubspotRes.status === 404) {
      return new Response(
        JSON.stringify({ success: false, message: 'El correo electrónico ingresado no se encuentra registrado en Boardroom.' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const data = await hubspotRes.json();

    // 3. Validar si ya cuenta con contraseña (Evita sobreescritura accidental)
    if (data.properties?.password_hash) {
      return new Response(
        JSON.stringify({ success: false, message: 'Este correo electrónico ya cuenta con una contraseña configurada.' }),
        { status: 409, headers: corsHeaders }
      );
    }

    // 4. INYECTAR CONTRASEÑA: Hacemos el PATCH al ID numérico exacto que nos retornó el paso anterior
    const updateUrl = `https://hubapi.com{data.id}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: hubspotHeaders,
      body: JSON.stringify({
        properties: {
          password_hash: hashedPassword,
          userstatus: 'Activo'
        }
      })
    });

    if (!updateRes.ok) {
      return new Response(
        JSON.stringify({ success: false, message: 'No se pudo almacenar la contraseña en tu registro de HubSpot.' }),
        { status: updateRes.status, headers: corsHeaders }
      );
    }

    // Respuesta exitosa mapeando los datos idénticos al login para el Dashboard
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contraseña asignada con éxito.',
        contact: {
          id: data.id,
          firstname: data.properties?.firstname || '',
          lastname: data.properties?.lastname || '',
          email: data.properties?.email || email,
          phone: data.properties?.phone || '',
          jobtitle: data.properties?.jobtitle || '',
          company: data.properties?.company || '',
          program: data.properties?.program || '',
          userstatus: 'Activo'
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: `Error en la ejecución: ${error.message}` }),
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
