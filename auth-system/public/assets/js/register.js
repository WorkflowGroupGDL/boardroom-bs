// public/assets/js/register.js
document.addEventListener('DOMContentLoaded', () => {
  const registroForm = document.getElementById('registroForm');
  if (!registroForm) return;

  const passInput = document.getElementById('inputPassword');
  const confirmInput = document.getElementById('confirmPassword');
  const submitBtn = document.getElementById('btnSubmit') || registroForm.querySelector('button[type="submit"]');

  // Contenedor dinámico de alertas visuales para contraseñas
  const errorDiv = document.createElement('div');
  errorDiv.style.fontWeight = 'bold';
  errorDiv.style.fontSize = '13px';
  errorDiv.style.marginTop = '5px';
  if (confirmInput && confirmInput.parentNode) {
    confirmInput.parentNode.appendChild(errorDiv);
  }

  // Comparación al instante (Mapeado en tiempo real)
  const verificarContrasenas = () => {
    const p1 = passInput.value;
    const p2 = confirmInput.value;

    if (!p2) {
      errorDiv.style.display = 'none';
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    errorDiv.style.display = 'block';

    if (p1 === p2) {
      errorDiv.innerText = '✓ Las contraseñas coinciden.';
      errorDiv.style.color = '#107c41';
      if (submitBtn) submitBtn.disabled = false; // Desbloquea
    } else {
      errorDiv.innerText = '✗ Las contraseñas no coinciden.';
      errorDiv.style.color = '#e81123';
      if (submitBtn) submitBtn.disabled = true; // Bloquea envío erróneo
    }
  };

  if (passInput) passInput.addEventListener('input', verificarContrasenas);
  if (confirmInput) confirmInput.addEventListener('input', verificarContrasenas);

  // Envío del Formulario
  registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('inputNombre')?.value.trim() || '';
    const apellido = document.getElementById('inputApellido')?.value.trim() || '';
    const email = document.getElementById('inputEmail')?.value.trim() || '';
    const password = passInput ? passInput.value : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Procesando...';
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstname: nombre, lastname: apellido })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('¡Registro y activación exitosa! Procede a iniciar sesión.');
        window.location.href = '/login.html';
      } else {
        alert(data.message || 'Error al procesar el registro.');
      }

    } catch (error) {
      console.error('Error en registro:', error);
      alert('Error de comunicación con la infraestructura del servidor.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Activar Acceso';
      }
    }
  });
});
