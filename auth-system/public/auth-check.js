const API_BASE_URL = window.location.origin;

function getToken() { return localStorage.getItem('jwt_token'); }
function setToken(token) { localStorage.setItem('jwt_token', token); }
function removeToken() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user');
}

function getStoredUser() {
  try {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  } catch (e) { return null; }
}

async function checkAuth() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Token expirado');
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
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

function logout() {
  removeToken();
  window.location.href = '/login.html';
}

window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.checkAuth = checkAuth;
window.requireAuth = requireAuth;
window.logout = logout;