// Reemplaza el bloque try/catch en tu app.js por este para depurar:
try {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  // Verificar si la respuesta es JSON antes de parsear
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const textError = await response.text();
    console.error('El servidor devolvió algo que no es JSON:', textError);
    throw new Error(`Respuesta inválida del servidor (${response.status})`);
  }

  const data = await response.json();

  if (response.ok && data.success) {
    if (data.contact) {
      localStorage.setItem('user', JSON.stringify(data.contact));
    } else if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    if (data.token && typeof window.setToken === 'function') {
      window.setToken(data.token);
    } else if (data.token) {
      localStorage.setItem('jwt_token', data.token);
    }

    if (resultDiv) {
      resultDiv.style.display = 'block';
      resultDiv.style.color = '#107c41';
      resultDiv.innerText = '¡Inicio de sesión exitoso! Redirigiendo...';
    }

    if (typeof window.renderAuthNavigation === 'function') {
      window.renderAuthNavigation();
    }

    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 800);

  } else {
    if (resultDiv) {
      resultDiv.style.display = 'block';
      resultDiv.style.color = '#e81123';
      resultDiv.innerText = data.message || 'Error al iniciar sesión. Verifique sus datos.';
    }
  }

} catch (error) {
  console.error('Error durante la autenticación:', error);
  if (resultDiv) {
    resultDiv.style.display = 'block';
    resultDiv.style.color = '#e81123';
    resultDiv.innerText = `Error de conexión: ${error.message}`;
  }
}