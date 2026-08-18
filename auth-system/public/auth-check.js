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
    return data.user || data.profile || null;
  } catch (error) {
    console.error('Error en checkAuth:', error);
    removeToken();
    return null;
  }
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

  const user = userData || await checkAuth();

  if (user) {
    const displayName = 
      user.firstname || 
      user.first_name || 
      user.name || 
      user.nombre || 
      (user.email ? user.email.split('@')[0] : 'Mi Cuenta');

    navContainer.innerHTML = `
      <span class="d-inline-flex align-items-center gap-2">
        <a href="/dashboard.html" target="_self" class="text-white fw-bold">
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

document.addEventListener('DOMContentLoaded', () => {
  renderAuthNavigation();
  setTimeout(renderAuthNavigation, 300);
});