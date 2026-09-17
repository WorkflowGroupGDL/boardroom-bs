document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registroForm');
  const pass = document.getElementById('inputPassword');
  const confirmPass = document.getElementById('confirmPassword');
  const errorDiv = document.getElementById('errorPassword');

  function checkPasswords() {
    if (confirmPass.value && pass.value !== confirmPass.value) {
      errorDiv.style.display = 'block';
      errorDiv.innerText = 'Las contraseñas no coinciden.';
      return false;
    }
    errorDiv.style.display = 'none';
    errorDiv.innerText = '';
    return true;
  }

  confirmPass.addEventListener('input', checkPasswords);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkPasswords()) return;

    const firstname = document.getElementById('inputNombre').value;
    const lastname = document.getElementById('inputApellido').value;
    const email = document.getElementById('inputEmail').value;
    const password = pass.value;

    try {
      const res = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstname, lastname, email, password })
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        window.location.href = 'login.html';
      } else {
        errorDiv.style.display = 'block';
        errorDiv.innerText = data.message;
      }
    } catch (err) {
      errorDiv.style.display = 'block';
      errorDiv.innerText = 'Error al comunicar con la API de registro.';
    }
  });
});