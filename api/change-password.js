// functions/api/change-password.js
import bcrypt from 'bcryptjs'; // Asegúrate de tener bcryptjs en las dependencias de tu proyecto Cloudflare

export async function onRequestPost(context) {
  const { request, env } = context;

  // Encabezados CORS estándar para comunicación interna y segura
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

    // 1. Validaciones básicas de entrada de datos
    if (!email || !currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, message: 'El correo, la contraseña actual y la nueva contraseña son obligatorios.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Extraer el token secreto de HubSpot de las variables de entorno de Cloudflare
    const token = env.HUBSPOT_TOKEN;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Error interno: HUBSPOT_TOKEN no configurado en Cloudflare.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 3. Consultar a HubSpot para obtener el hash de la contraseña actual guardada
    const propertiesQuery = 'email,password_hash';
    const hubspotSearchUrl = `https://hubapi.com{encodeURIComponent(email)}?idProperty=email&properties=${propertiesQuery}`;
    
    const hubspotSearchRes = await fetch(hubspotSearchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const contactData = await hubspotSearchRes.json();

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

    // 4. Verificar con bcrypt si la contraseña actual ingresada coincide con el hash del CRM
    const isPasswordValid = await bcrypt.compare(currentPassword, currentHash);
    if (!isPasswordValid) {
      return new Response(
        JSON.stringify({ success: false, message: 'La contraseña actual introducida es incorrecta.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 5. Generar el nuevo hash seguro para la nueva contraseña elegida
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 6. Actualizar la propiedad de contraseña cifrada en HubSpot usando el ID único del contacto
    const hubspotUpdateUrl = `https://hubapi.com{contactId}`;
    const hubspotUpdateRes = await fetch(hubspotUpdateUrl, {
      method: 'PATCH', // Usamos PATCH para actualizar parcialmente las propiedades del contacto
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
      const errorUpdateData = await hubspotUpdateRes.json();
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error al actualizar las credenciales en HubSpot.', 
          details: errorUpdateData 
        }),
        { status: hubspotUpdateRes.status, headers: corsHeaders }
      );
    }

    // Respuesta final exitosa devuelta al formulario de la web
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

// Soporte mandatorio para peticiones de verificación previas de los navegadores (Pre-flight OPTIONS)
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
