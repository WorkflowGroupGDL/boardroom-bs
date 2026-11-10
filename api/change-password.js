// functions/api/change-password.js
import bcrypt from 'bcryptjs'; // Cambiado a importación nativa compatible con Cloudflare Pages

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

    // 1. Validaciones iniciales
    if (!email || !currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, message: 'El correo, la contraseña actual y la nueva contraseña son obligatorios.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const token = env.HUBSPOT_TOKEN;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Error de configuración interna: HUBSPOT_TOKEN no definido en Cloudflare.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 2. Búsqueda correcta del contacto en HubSpot CRM v3
    const propertiesQuery = 'email,password_hash';
    const hubspotSearchUrl = `https://hubapi.com{encodeURIComponent(email)}?idProperty=email&properties=${propertiesQuery}`;
    
    const hubspotSearchRes = await fetch(hubspotSearchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!hubspotSearchRes.ok) {
      return new Response(
        JSON.stringify({ success: false, message: 'El usuario no existe en la base de datos de Boardroom.' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const contactData = await hubspotSearchRes.json();
    const contactId = contactData.id;
    const currentHash = contactData.properties?.password_hash;

    if (!currentHash) {
      return new Response(
        JSON.stringify({ success: false, message: 'Este usuario no tiene un acceso activo en el portal. Regístrese primero.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Verificación usando la librería bcryptjs integrada
    const isPasswordValid = await bcrypt.compare(currentPassword, currentHash);
    if (!isPasswordValid) {
      return new Response(
        JSON.stringify({ success: false, message: 'La contraseña actual introducida es incorrecta.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 4. Generar nuevo hash compatible
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 5. Actualizar el password_hash en HubSpot mediante PATCH
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

    if (!hubspotUpdateRes.ok) {
      return new Response(
        JSON.stringify({ success: false, message: 'Error al intentar guardar las nuevas credenciales en el CRM.' }),
        { status: 502, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Contraseña actualizada con éxito en la plataforma.' }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: `Error crítico en ejecución: ${error.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// Soporte obligatorio para peticiones de verificación previas (Pre-flight OPTIONS)
// Esto evita errores 405 cuando el navegador valida los encabezados antes del POST
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
