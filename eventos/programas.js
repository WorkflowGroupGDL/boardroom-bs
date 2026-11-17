(() => {
    const contenedorprogramas = document.getElementById('lista-programas');
    if (!contenedorprogramas) return;
  
    // Ruta de tu archivo JSON
    const URL_programas = 'eventos/programas.json';
  
    // Fecha actual en formato YYYY-MM-DD para comparar cronológicamente
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    const fechaHoyFormateada = `${año}-${mes}-${dia}`;
  
    // Función para recortar descripciones largas
    function recortarTexto(texto, limite = 100) {
      if (!texto) return '';
      const textoLimpio = texto.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      return textoLimpio.length > limite ? textoLimpio.slice(0, limite) + '...' : textoLimpio;
    }
  
    // Función para convertir YYYY-MM-DD a DD/MM/YYYY
    function formatoFecha(fecha) {
      if (!fecha) return '';
      const fechaLimpia = fecha.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (!fechaLimpia.includes('-')) return fechaLimpia;
      const [año, mes, dia] = fechaLimpia.split('-');
      return `${dia}/${mes}/${año}`;
    }
  
    fetch(URL_programas)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status} al cargar ${URL_programas}`);
        }
        return response.json();
      })
      .then(programas => {
        contenedorprogramas.innerHTML = '';
  
        // Convierte en arreglo si el JSON contiene un solo objeto
        const listaprogramas = Array.isArray(programas) ? programas : [programas];
  
        // Filtra por fechas actuales o futuras y por estado activo (si existe el campo)
        const programasFiltrados = listaprogramas.filter(programa => {
          const cumpleFecha = !programa.fecha || programa.fecha >= fechaHoyFormateada || programa.fecha === 'Proximamente';
          const estaActivo = programa.activo === undefined || programa.activo == 1;
          return cumpleFecha && estaActivo;
        });
  
        if (programasFiltrados.length === 0) {
          contenedorprogramas.innerHTML = `<p>No hay programas próximos programados.</p>`;
          return;
        }
  
        programasFiltrados.forEach(programa => {
          const descripcionCorta = recortarTexto(programa.descripcion || programa.descripcion_larga, 100);
          
          const card = document.createElement('div');
          card.className = 'card-programas';
            card.innerHTML = `
            <div class="card">
           <img src="${programa.imagen}" alt="${programa.titulo}" style="width:100%; height:200px; object-fit:cover; border-radius: 4px;">
           <div class="card-body px-4"> 
           <h4 class="my-3">&nbsp;&nbsp;${programa.titulo}</h4>
            <p><strong>Início:</strong> <strong class="text-danger">${formatoFecha(programa.fecha)}</strong></p>
            <p><strong>Descripción:</strong> ${descripcionCorta}</p>
            <p class="main-button-blue pt-5 text-center text-white text-bolder">
              <a target="_self" href="${programa.url}?id=${programa.id}">más información</a>
            </p>
            </div>
            </div>
          `;
          contenedorprogramas.appendChild(card);
        });
  
        // Guardamos en localStorage para la página de detalle
        localStorage.setItem('programas_ws_cache', JSON.stringify(listaprogramas));
      })
      .catch(error => {
        contenedorprogramas.innerHTML = `<p>Error al cargar los programas.</p>`;
        console.error('Detalle del error en programas.js:', error);
      });
  })();
  