  document.addEventListener('DOMContentLoaded', async () => {
    const contenedorMenu = document.getElementById('contenedorMenu');
    const etiquetaRol = document.getElementById('etiquetaRol');
    
    // Obtiene el token usando tu helper existente (o fallback a localStorage)
    const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('token');

    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/menus/mi-menu`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        // Si el token expiró, redirigir al login
        window.location.href = 'login.html';
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Error al obtener el menú');
      }

      if (etiquetaRol) etiquetaRol.textContent = data.rol;

      const rutaActual = window.location.pathname;
      contenedorMenu.innerHTML = data.items.map((opcion) => {
        const activo = rutaActual === opcion.url ? 'active fw-bold' : '';
        return `
          <li class="nav-item">
            <a class="nav-link ${activo}" href="${opcion.url}">
              ${opcion.icono ? `<i class="bi ${opcion.icono} me-1"></i>` : ''}
              ${opcion.titulo}
            </a>
          </li>
        `;
      }).join('');
    } catch (error) {
      console.error('Error al armar el menú:', error);
      contenedorMenu.innerHTML = '<li class="nav-item"><span class="nav-link text-danger">Error al cargar menú</span></li>';
    }
  });
