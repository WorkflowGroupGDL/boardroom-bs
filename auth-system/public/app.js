// public/app.js

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const resultDiv = document.getElementById('result');
    const submitBtn = document.getElementById('submitBtn') || loginForm.querySelector('button[type="submit"]');

    if (!emailInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput ? passwordInput.value : '';

    // Estado visual de carga
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Verificando...';
    }

    if (resultDiv) {
      resultDiv.style.display = 'none';
    }

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      // Validación para evitar fallos si el servidor devuelve HTML en lugar de JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textError = await response.text();
        throw new Error(`Respuesta no válida del servidor (${response.status}).`);
      }

      const data = await response.json();

      if (response.ok && data.success) {
        // Guardar sesión del usuario
        if (data.contact) {
          localStorage.setItem('user', JSON.stringify(data.contact));
        }

        if (resultDiv) {
          resultDiv.style.display = 'block';
          resultDiv.style.color = '#107c41';
          resultDiv.innerText = '¡Inicio de sesión exitoso! Redirigiendo...';
        }

        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 800);

      } else {
        if (resultDiv) {
          resultDiv.style.display = 'block';
          resultDiv.style.color = '#e81123';
          resultDiv.innerText = data.message || 'Error al iniciar sesión.';
        }
      }

    } catch (error) {
      console.error('Error en autenticación:', error);
      if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.style.color = '#e81123';
        resultDiv.innerText = error.message.includes('Respuesta no válida')
          ? 'Error de ruta: /api/login no está respondiendo en JSON.'
          : 'Error de conexión con el servidor.';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Ingresar';
      }
    }
  });
});