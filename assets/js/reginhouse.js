document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registroForm');
  const pass = document.getElementById('inputPassword');
  const confirmPass = document.getElementById('confirmPassword');
  const errorDiv = document.getElementById('errorPassword');
  const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3000' 
  : 'https://boardroom-bs-api.onrender.com';

 form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!checkPasswords()) return;

    const firstname = document.getElementById('inputNombre').value;
    const lastname = document.getElementById('inputApellido').value;
    const email = document.getElementById('inputEmail').value;
    const password = pass.value;
    const phone = document.getElementById('inputTelefono').value;
    const city = document.getElementById('inputCity').value;
    const state = document.getElementById('inputState').value;
    const country = document.getElementById('inputCountry').value;
    const jobtitle = document.getElementById('inputJobTitle').value;  
    const company = document.getElementById('inputCompany').value;
    const field_of_study = document.getElementById('inputFieldOfStudy').value;
    const hs_linkedin_url = document.getElementById('inputLinkedIn').value;
    const asunto = document.getElementById('inputAsunto').value;
    const mensaje = document.getElementById('inputMensaje').value;

    try {
      const res = await fetch(`${API_BASE_URL}/api/reginhouse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstname, lastname, email, password, phone, city, state, country, jobtitle, company, field_of_study, hs_linkedin_url, asunto, mensaje })
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        window.location.href = 'programas-in-house.html';
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