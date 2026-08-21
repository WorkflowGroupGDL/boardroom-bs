document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    // 1. Evitar la recarga por defecto del formulario HTML
    e.preventDefault();

    // 2. Obtener referencias a los elementos del DOM
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password'); // Opcional si usas contraseña
    const resultDiv = document.getElementById('result');
    const submitBtn = document.getElementById('submitBtn') || loginForm.querySelector('button[type="submit"]');

    if (!emailInput) {
      console.error('No se encontró el campo de correo (#email)');
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput ? passwordInput.value : '';

    // 3. Estado de carga en la UI
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Verificando...';
    }

    if (resultDiv) {
      resultDiv.style.display = 'none';
      resultDiv.className = '';
    }

    try {
      // 4. Petición POST al backend en Express
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 5. Guardar la información del usuario para auth-check.js y el menú
        if (data.contact) {
          localStorage.setItem('user', JSON.stringify(data.contact));
        } else if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        // Si tu backend genera un token JWT, lo guardamos con la función de auth-check.js
        if (data.token && typeof window.setToken === 'function') {
          window.setToken(data.token);
        } else if (data.token) {
          localStorage.setItem('jwt_token', data.token);
        }

        // 6. Notificación visual de éxito
        if (resultDiv) {
          resultDiv.style.display = 'block';
          resultDiv.style.color = '#107c41';
          resultDiv.innerText = '¡Inicio de sesión exitoso! Redirigiendo...';
        }

        // 7. Actualizar la navegación global y redirigir al Dashboard
        if (typeof window.renderAuthNavigation === 'function') {
          window.renderAuthNavigation();
        }

        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 800);

      } else {
        // Manejar respuesta de error enviada desde Express/HubSpot
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
        resultDiv.innerText = 'Error de conexión con el servidor. Intente más tarde.';
      }
    } finally {
      // Restablecer el botón de envío
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Ingresar';
      }
    }
  });
});