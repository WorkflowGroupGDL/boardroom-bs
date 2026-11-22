document.addEventListener('DOMContentLoaded', async () => {
    const contenedorMenu = document.getElementById('menu-dinamico');
    const userInfo = document.getElementById('user-info');
  
    if (!contenedorMenu) return;
  
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
        if (typeof logout === 'function') logout();
        else window.location.href = 'login.html';
        return;
      }
  
      const data = await response.json();
  
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'No se pudo cargar el menú');
      }
  
      // Mostrar el perfil activo en tu párrafo #user-info
      if (userInfo) {
        const userLocal = JSON.parse(localStorage.getItem('user') || '{}');
        const nombre = userLocal.firstname ? `${userLocal.firstname} ${userLocal.lastname || ''}`.trim() : '';
        userInfo.innerHTML = `
          ${nombre ? `<strong>${nombre}</strong><br>` : ''}
          Perfil asignado: <span class="badge bg-dark">${data.rol}</span>
        `;
      }
  
      // Construir los botones verticales dentro de #menu-dinamico
      const paginaActual = window.location.pathname.split('/').pop();
  
      const botonesHtml = data.items.map((opcion) => {
        const urlPagina = opcion.url.split('/').pop();
        const esActiva = paginaActual === urlPagina;
        
        // Si es la página actual se pinta oscuro (btn-dark), si no, contorno (btn-outline-dark)
        const claseBoton = esActiva ? 'btn-dark' : 'btn-outline-dark';
  
        return `
          <a href="${opcion.url}" class="btn ${claseBoton} w-100 text-start fw-semibold">
            ${opcion.icono ? `<i class="fa ${opcion.icono} me-2"></i>` : ''}
            ${opcion.titulo}
          </a>
        `;
      }).join('');
  
      contenedorMenu.innerHTML = `
        <h6 class="text-uppercase text-muted fw-bold small mb-2">Accesos de ${data.rol}</h6>
        <div class="d-grid gap-2">
          ${botonesHtml}
        </div>
      `;
  
    } catch (error) {
      console.error('Error construyendo el menú lateral:', error);
      contenedorMenu.innerHTML = `
        <div class="alert alert-warning py-2 small mb-0">
          No se pudieron cargar las opciones de tu perfil.
        </div>
      `;
    }
  });
  