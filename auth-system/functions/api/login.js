// functions/api/login.js

export async function onRequestPost(context) {
  const { request, env } = context;

  // Encabezados CORS para permitir peticiones seguras
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  try {
    const body = await request.json();
    const email = body.email ? body.email.trim() : '';

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, message: 'El correo electrónico es requerido.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Obtener la variable de entorno desde la configuración de Cloudflare Pages
    const token = env.HUBSPOT_TOKEN;

    if (!token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error de configuración: HUBSPOT_TOKEN no definido en Cloudflare.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 1. Definimos las propiedades que queremos traer de vuelta
    const propertiesNeeded = [
      'firstname',
      'lastname',
      'email',
      'phone',
      'jobtitle',
      'company',
      'program',
      'userstatus',
      'token'
    ];
    const propertiesQuery = propertiesNeeded.join(',');

    // 2. CORRECCIÓN: Unimos todo en la URL real del fetch con "&properties="
    const hubspotUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email&properties=${propertiesQuery}`;
    
    const hubspotRes = await fetch(hubspotUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await hubspotRes.json();

    if (!hubspotRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Contacto no encontrado en HubSpot o credenciales inválidas.',
          details: data
        }),
        { status: hubspotRes.status, headers: corsHeaders }
      );
    }

    // Respuesta exitosa al cliente con todas las propiedades solicitadas
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login exitoso',
        contact: {
          id: data.id,
          firstname: data.properties?.firstname || '',
          lastname: data.properties?.lastname || '',
          email: data.properties?.email || email,
          phone: data.properties?.phone || '',
          jobtitle: data.properties?.jobtitle || '',
          company: data.properties?.company || '',
          program: data.properties?.program || '',
          userstatus: data.properties?.userstatus || '',
          token: data.properties?.token || ''
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: `Error del servidor: ${error.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// Soporte para peticiones pre-flight CORS (OPTIONS)
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
