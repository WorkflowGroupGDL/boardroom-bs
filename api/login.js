// functions/api/login.js

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'La solicitud debe contener un JSON válido.'
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  const email =
    typeof body?.email === 'string'
      ? body.email.trim().toLowerCase()
      : '';

  // No eliminar espacios de la contraseña.
  const password =
    typeof body?.password === 'string'
      ? body.password
      : '';

  if (!email || !password) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Email y contraseña requeridos.'
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (!env.AUTH_BACKEND_URL) {
    console.error('AUTH_BACKEND_URL no está configurada.');

    return new Response(
      JSON.stringify({
        success: false,
        message: 'El servicio de autenticación no está configurado.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const loginUrl = new URL('/api/login', env.AUTH_BACKEND_URL);

    if (loginUrl.protocol !== 'https:') {
      throw new Error('El backend debe utilizar HTTPS.');
    }

    const backendResponse = await fetch(loginUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      }),
      redirect: 'error'
    });

    let data;

    try {
      data = await backendResponse.json();
    } catch {
      console.error('El backend de login no devolvió JSON:', {
        status: backendResponse.status
      });

      return new Response(
        JSON.stringify({
          success: false,
          message:
            'El servicio de autenticación devolvió una respuesta inválida.'
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    if (!backendResponse.ok || data?.success !== true) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            backendResponse.status === 401
              ? 'Credenciales incorrectas.'
              : 'No se pudo completar el inicio de sesión.'
        }),
        {
          status: backendResponse.ok ? 502 : backendResponse.status,
          headers: corsHeaders
        }
      );
    }

    if (typeof data.token !== 'string' || !data.user) {
      console.error('La respuesta de login no incluye token o usuario.');

      return new Response(
        JSON.stringify({
          success: false,
          message:
            'El servicio de autenticación devolvió una respuesta incompleta.'
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: data.message || 'Inicio de sesión exitoso.',
        token: data.token,
        user: data.user
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch {
    console.error(
      'No fue posible conectar con el backend de autenticación.'
    );

    return new Response(
      JSON.stringify({
        success: false,
        message: 'No fue posible conectar con el servicio de autenticación.'
      }),
      { status: 502, headers: corsHeaders }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}