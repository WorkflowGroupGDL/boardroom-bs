// api/register.js - Código 100% compatible con Tencent Cloud EdgeOne Functions

export async function onRequestPost(context) {
  const { request, env } = context;

  // Encabezados CORS integrales para producción
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  try {
    // 1. Extraer y validar el cuerpo de la petición de forma segura
    const body = await request.json();
    const email = body.email ? body.email.trim() : '';
    const password = body.password || '';

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'El correo electrónico y la contraseña son campos requeridos.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const token = env.HUBSPOT_TOKEN;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Falla interna: HUBSPOT_TOKEN no está definido en el entorno de Tencent Cloud.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 2. Encriptación nativa SHA-256 en el Edge (Cero dependencias externas)
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const hubspotHeaders = {
      'Authorization': `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // 3. PASO 1: Validar si el contacto existe en HubSpot a través de su correo
    // Pedimos las propiedades necesarias de inmediato
    const propertiesQuery = 'password_hash,firstname,lastname,email,phone,jobtitle,company,program,userstatus';
    const getUrl = `https://hubapi.com{encodeURIComponent(email)}?idProperty=email&properties=${propertiesQuery}`;
    
    const getRes = await fetch(getUrl, { method: 'GET', headers: hubspotHeaders });

    // Si no se encuentra el correo registrado en el CRM
    if (getRes.status === 404) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Tu correo electrónico no está registrado en el sistema de Boardroom. Solicita tu alta con administración.' 
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Si HubSpot devuelve un HTML de error o bloqueo, lo atrapamos de forma segura como texto
    if (!getRes.ok) {
      const errTxt = await getRes.text();
      return new Response(
        JSON.stringify({ success: false, message: `HubSpot denegó la consulta de validación (Status ${getRes.status}).`, debug: errTxt.substring(0, 150) }),
        { status: 502, headers: corsHeaders }
      );
    }

    const contactData = await getRes.json();
    const contactId = contactData.id;

    // 4. PASO 2: Verificar si ya tenía una contraseña activa
    if (contactData.properties?.password_hash) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Este correo electrónico ya cuenta con una contraseña activa. Por favor, ve a la pantalla de Inicio de Sesión.' 
        }),
        { status: 409, headers: corsHeaders }
      );
    }

    // 5. PASO 3: Actualizar el contacto existente agregando el Hash usando PATCH
    const updateUrl = `https://hubapi.com{contactId}`;
    const updatePayload = {
      properties: {
        password_hash: hashedPassword,
        userstatus: 'Activo'
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
        JSON.stringify({ success: false, message: 'El correo existe, pero el CRM rechazó almacenar la contraseña.', debug: updateErr.substring(0, 150) }),
        { status: updateRes.status, headers: corsHeaders }
      );
    }

    // 6. Registro/Activación exitosa: Retornamos el objeto limpio estructurado para el Dashboard
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contraseña asignada con éxito. Tu cuenta ha sido activada.',
        contact: {
          id: contactId,
          email: email,
          firstname: contactData.properties?.firstname || '',
          lastname: contactData.properties?.lastname || '',
          phone: contactData.properties?.phone || '',
          jobtitle: contactData.properties?.jobtitle || '',
          company: contactData.properties?.company || '',
          program: contactData.properties?.program || '',
          userstatus: 'Activo'
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: `Falla crítica interna en el Edge de Tencent: ${error.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// Interceptor para peticiones pre-flight CORS
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
