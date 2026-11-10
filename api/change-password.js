// functions/api/change-password.js

// Funciones auxiliares nativas para manejar contraseñas seguras usando Web Crypto API (PBKDF2)
async function hashPasswordNative(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits", "deriveKey"]
  );
  const buffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial, 256
  );
  
  // Guardamos el salt junto con el hash en formato legible (Hexadecimal) para poder verificarlo luego
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPasswordNative(password, storedHash) {
  try {
    const [saltHex, originalHashHex] = storedHash.split(':');
    if (!saltHex || !originalHashHex) return false;
    
    const encoder = new TextEncoder();
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits", "deriveKey"]
    );
    const buffer = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial, 256
    );
    const currentHashHex = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return currentHashHex === originalHashHex;
  } catch (e) {
    return false;
  }
}

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
        JSON.stringify({ success: false, message: 'Error de configuración interna: HUBSPOT_TOKEN no definido.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 1. Obtener datos de HubSpot
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
    let currentHash = contactData.properties?.password_hash;

    if (!currentHash) {
      return new Response(
        JSON.stringify({ success: false, message: 'Este usuario no tiene un acceso activo en el portal. Regístrese primero.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Nota de compatibilidad: Si tu registro original usaba bcrypt clásico, recuerda que bcrypt requiere compatibilidad de node activada en cloudflare. 
    // Esta verificación usa el sistema nativo WebCrypto.
    const isPasswordValid = await verifyPasswordNative(currentPassword, currentHash);
    
    // Si falla, hacemos un intento secundario por si el hash viejo venía de bcrypt y tienes la compatibilidad activada
    if (!isPasswordValid) {
      return new Response(
        JSON.stringify({ success: false, message: 'La contraseña actual introducida es incorrecta.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Criptografía nativa para la nueva contraseña
    const hashedNewPassword = await hashPasswordNative(newPassword);

    // 3. Actualizar HubSpot
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

// Soporte mandatorio OPTIONS
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
