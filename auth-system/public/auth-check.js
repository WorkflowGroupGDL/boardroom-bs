const API_BASE_URL = (() => {
  const configured = (window.BOARDROOM_API_BASE_URL || '').replace(/\/$/, '');
  if (configured) return configured;

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  return window.location.origin || '';
})();

// Gestores de Token y Usuario
function getToken() {
  return localStorage.getItem('jwt_token');
}

function setToken(token) {
  localStorage.setItem('jwt_token', token);
}

function removeToken() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user');
}

// Obtener objeto usuario guardado localmente tras el login
function getStoredUser() {
  try {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  } catch (e) {
    return null;
  }
}

async function checkAuth() {
  const token = getToken();
  const localUser = getStoredUser();

  // 1. Si existe un token JWT, validar contra el backend /api/profile
  if (token) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        cache: 'no-store'
      });

      if (!res.ok) throw new Error(`Sesión no válida (${res.status})`);

      const data = await res.json();
      const user = data.user || data.profile || (data.email ? data : null);
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        return user;
      }
    } catch (error) {
      console.warn('Error en checkAuth con token API:', error.message);
      removeToken();
      return null;
    }
  }

  // 2. Si no hay JWT pero existe usuario registrado en localStorage (Login con HubSpot)
  if (localUser && (localUser.id || localUser.email)) {
    return localUser;
  }

  return null;
}

async function requireAuth() {
  const user = await checkAuth();
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

function logout() {
  removeToken();
  window.location.href = '/login.html';
}

async function renderAuthNavigation(userData = null) {
  const navContainer = document.getElementById('auth-nav-container');
  if (!navContainer) return;

  const user = userData !== null ? userData : await checkAuth();

  if (user) {
    const displayName =
      user.firstname ||
      user.nombre ||
      (user.email ? user.email.split('@')[0] : 'Mi Cuenta');

    navContainer.innerHTML = `
      <span class="d-inline-flex align-items-center gap-2">
        <a href="/dashboard.html" target="_self" class="text-white fw-bold text-decoration-none">
          <i class="fa fa-user-circle"></i> ${displayName}
        </a>
        <a href="#" onclick="event.preventDefault(); logout();" class="text-white ms-2 text-decoration-none" title="Cerrar Sesión">
          <i class="fa fa-sign-out-alt"></i> Salir
        </a>
      </span>
    `;
    navContainer.style.display = 'inline-block';
  } else {
    navContainer.innerHTML = `
      <a href="/login.html" target="_self" class="text-white text-decoration-none">
        <i class="fa fa-user"></i> Iniciar Sesión
      </a>
    `;
    navContainer.style.display = 'inline-block';
  }
}

// Exponer funciones en el scope global
window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.getStoredUser = getStoredUser;
window.checkAuth = checkAuth;
window.requireAuth = requireAuth;
window.logout = logout;
window.renderAuthNavigation = renderAuthNavigation;

document.addEventListener('DOMContentLoaded', () => {
  renderAuthNavigation();
});