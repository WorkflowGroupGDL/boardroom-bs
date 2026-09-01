// index.js - Compatible con Tencent Cloud EdgeOne / Edge Functions

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // Manejo de la ruta /api/login
  if (url.pathname === '/api/login') {
    
    // Soporte para solicitudes CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, message: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await request.json();
      const email = body.email ? body.email.trim() : '';

      if (!email) {
        return new Response(JSON.stringify({ success: false, message: 'El correo electrónico es requerido.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Obtener la variable de entorno configurada en la consola de Tencent Cloud
      const token = typeof process !== 'undefined' && process.env && process.env.HUBSPOT_TOKEN
        ? process.env.HUBSPOT_TOKEN
        : (typeof HUBSPOT_TOKEN !== 'undefined' ? HUBSPOT_TOKEN : '');

      if (!token) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Error de servidor: HUBSPOT_TOKEN no configurado en Tencent Cloud.' 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Consulta a la API de HubSpot
      const hubspotUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`;
      const hubspotRes = await fetch(hubspotUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

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
    const hubspotUrl2 = `https://hubapi.com{contactId}?properties=${propertiesQuery}`;

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
        email: data.properties?.email || email,
        phone: data.properties?.phone || '',
        jobtitle: data.properties?.jobtitle || '',
        company: data.properties?.company || '',
        program: data.properties?.program || '',
        userstatus: data.properties?.userstatus || '',
        token: data.properties?.token || ''
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ success: false, message: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Dejar pasar los archivos estáticos de la carpeta public/
  return fetch(request);
}