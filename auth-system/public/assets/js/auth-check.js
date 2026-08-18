// public/auth-check.js

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:3000' 
  : '';

function getToken() {
  return localStorage.getItem('jwt_token');
}

function setToken(token) {
  localStorage.setItem('jwt_token', token);
}

function removeToken() {
  localStorage.removeItem('jwt_token');
}

async function checkAuth() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });

    if (!res.ok) throw new Error('Sesión no válida o expirada');

    const data = await res.json();
    return data.user;
  } catch (error) {
    console.error('Error en checkAuth:', error);
    localStorage.removeItem('jwt_token');
    return null;
  }
}

/**
 * Protege páginas privadas (como /private/dashboard.html).
 */
async function requireAuth() {
  const user = await checkAuth();
  if (!user) {
    // CORRECCIÓN: Ruta absoluta hacia la carpeta public
    window.location.href = '/login.html'; // o '/public/login.html' según tu servidor
    return null;
  }
  return user;
}

function logout() {
  removeToken();
  // CORRECCIÓN: Ruta absoluta
  window.location.href = '/login.html';
}

// public/auth-check.js

async function renderAuthNavigation(userData = null) {
  const navContainer = document.getElementById('auth-nav-container');
  if (!navContainer) return;

  // Si no le pasamos los datos, los busca mediante checkAuth()
  const user = userData || await checkAuth();

  if (user) {
    // Evaluación exhaustiva de todas las llaves posibles
    const displayName = 
      user.firstname || 
      user.first_name || 
      user.name || 
      user.nombre || 
      (user.email ? user.email.split('@')[0] : 'Mi Cuenta');

    navContainer.innerHTML = `
      <span class="d-inline-flex align-items-center gap-2">
        <a href="/private/dashboard.html" target="_self" class="text-white fw-bold">
          <i class="fa fa-user-circle"></i> ${displayName}
        </a>
        <a href="#" onclick="event.preventDefault(); logout();" class="text-white ms-2" title="Cerrar Sesión">
          <i class="fa fa-sign-out-alt"></i> Salir
        </a>
      </span>
    `;
    navContainer.style.display = 'inline-block';
  } else {
    navContainer.innerHTML = `
      <a href="/login.html" target="_self" class="text-white">
        <i class="fa fa-user"></i> Iniciar Sesión
      </a>
    `;
  }
}

// Ejecución con tolerancia para librerías de plantillas (TemplateMo / Material Kit)
document.addEventListener('DOMContentLoaded', () => {
  // Ejecución inmediata
  renderAuthNavigation();

  // Re-ejecución tras 300ms para sobreescribir cualquier limpieza realizada por custom.js
  setTimeout(renderAuthNavigation, 300);
});