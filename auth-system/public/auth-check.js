// Cambia esto a la URL pública de tu Render Web Service cuando esté desplegado:
// Ej: 'https://boardroom-api.onrender.com'
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3000' 
  : 'https://boardroom-bs-api.onrender.com';

function getToken() { return localStorage.getItem('jwt_token'); }
function setToken(token) { localStorage.setItem('jwt_token', token); }
function removeToken() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user');
}

async function checkAuth() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Sesión no válida');
    const data = await res.json();
    return data.user;
  } catch (error) {
    removeToken();
    return null;
  }
}

async function requireAuth() {
  const user = await checkAuth();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

function logout() {
  removeToken();
  window.location.href = 'login.html';
}

window.API_BASE_URL = API_BASE_URL;
window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.checkAuth = checkAuth;
window.requireAuth = requireAuth;
window.logout = logout;