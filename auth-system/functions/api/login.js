export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const email = body.email ? body.email.trim() : '';

    if (!email) {
      return new Response(JSON.stringify({ success: false, message: 'El correo es requerido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Leer la variable de entorno configurada en Cloudflare
    const token = env.HUBSPOT_TOKEN;

    if (!token) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Error de servidor: HUBSPOT_TOKEN no está configurado en Cloudflare Pages.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Petición a la API de HubSpot
    const hubspotUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`;
    const hubspotRes = await fetch(hubspotUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await hubspotRes.json();

    if (!hubspotRes.ok) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Contacto no encontrado en HubSpot.',
        details: data
      }), {
        status: hubspotRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      contact: {
        id: data.id,
        firstname: data.properties?.firstname || '',
        lastname: data.properties?.lastname || '',
        email: data.properties?.email || email
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}