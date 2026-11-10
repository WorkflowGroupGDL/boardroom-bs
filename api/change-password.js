// functions/api/change-password.js
import bcrypt from 'bcryptjs';

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
    const email = body.email ? body.email.trim().toLowerCase() : '';
    const currentPassword = body.currentPassword;
    const newPassword = body.newPassword;

    if (!email || !currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, message: 'El correo, la contraseña actual y la nueva contraseña son obligatorios.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const token = env.HUBSPOT_TOKEN;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Error interno: HUBSPOT_TOKEN no configurado en Cloudflare.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 1. Consultar a HubSpot
    const propertiesQuery = 'email,password_hash';
    const hubspotSearchUrl = `https://hubapi.com{encodeURIComponent(email)}?idProperty=email&properties=${propertiesQuery}`;
    
    const hubspotSearchRes = await fetch(hubspotSearchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // PROTECCIÓN: Leer primero como texto para evitar caídas si viene vacío
    const searchResText = await hubspotSearchRes.text();
    let contactData = {};
    try {
      contactData = searchResText ? JSON.parse(searchResText) : {};
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, message: 'HubSpot devolvió una respuesta ilegible.' }),
        { status: 502, headers: corsHeaders }
      );
    }

    if (!hubspotSearchRes.ok) {
      return new Response(
        JSON.stringify({ success: false, message: 'El usuario no existe en la base de datos de Boardroom.' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const contactId = contactData.id;
    const currentHash = contactData.properties?.password_hash;

    if (!currentHash) {
      return new Response(
        JSON.stringify({ success: false, message: 'Este usuario no tiene un acceso activo en el portal. Regístrese primero.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Verificar contraseña actual con bcrypt
    const isPasswordValid = await bcrypt.compare(currentPassword, currentHash);
    if (!isPasswordValid) {
      return new Response(
        JSON.stringify({ success: false, message: 'La contraseña actual introducida es incorrecta.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 3. Generar nuevo hash
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 4. Actualizar en HubSpot
    const hubspotUpdateUrl = `https://hubapi.com{contactId}`;
    const hubspotUpdateRes = await fetch(hubspotUpdateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          password_hash: hashedNewPassword
        }
      })
    });

    // PROTECCIÓN: Leer respuesta de actualización de forma segura
    const updateResText = await hubspotUpdateRes.text();
    let errorUpdateData = {};
    try {
      errorUpdateData = updateResText ? JSON.parse(updateResText) : {};
    } catch (e) {
      errorUpdateData = { message: 'Respuesta no analizable de HubSpot.' };
    }

    if (!hubspotUpdateRes.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error al actualizar las credenciales en HubSpot.', 
          details: errorUpdateData 
        }),
        { status: hubspotUpdateRes.status, headers: corsHeaders }
      );
    }

    // Éxito rotundo: Siempre devolvemos un JSON estructurado
    return new Response(
      JSON.stringify({ success: true, message: 'Contraseña actualizada con éxito en la plataforma.' }),
      { status: 200, headers: corsHeaders }
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
