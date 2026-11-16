document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener el parámetro 'id' de la URL actual (ej. ?id=4)
    const params = new URLSearchParams(window.location.search);
    const cursoId = parseInt(params.get('id'), 10);

    // Validar que exista un ID válido en la URL
    if (!cursoId) {
        console.error('No se proporcionó un ID válido en la URL.');
        mostrarError('Curso no especificado. Verifica el enlace.');
        return;
    }

    // Ruta hacia tu archivo JSON (ajústala si está en otra carpeta, ej: 'assets/data/cursos.json')
    const RUTA_JSON = 'cursos/cursos.json';

    // 2. Leer el archivo JSON y buscar el curso correspondiente
    fetch(RUTA_JSON)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar el archivo JSON (Código ${response.status})`);
            }
            return response.json();
        })
        .then(datos => {
            // Soportar tanto si el JSON es un arreglo de cursos [...] como si es un solo objeto {...}
            const listaCursos = Array.isArray(datos) ? datos : [datos];
            const curso = listaCursos.find(item => item.id === cursoId);

            if (!curso) {
                mostrarError('El curso solicitado no fue encontrado.');
                return;
            }

            // 3. Inyectar la información en el HTML
            renderizarCurso(curso);
        })
        .catch(error => {
            console.error('Error procesando los datos:', error);
            mostrarError('Ocurrió un problema al cargar la información del programa.');
        });
});

// Función auxiliar para asignar texto de forma segura (evita errores si un ID no existe en el HTML)
function asignarTexto(idElemento, valor, textoPorDefecto = '') {
    const elemento = document.getElementById(idElemento);
    if (elemento) {
        elemento.textContent = valor || textoPorDefecto;
    }
}

// Función auxiliar para asignar HTML enriquecido (útil para textos largos con etiquetas <p>, <ul>, etc.)
function asignarHTML(idElemento, valor) {
    const elemento = document.getElementById(idElemento);
    if (elemento && valor) {
        elemento.innerHTML = valor;
    }
}

// Función principal que mapea todos los campos del JSON a la página
function renderizarCurso(curso) {
    // Actualizar el título de la pestaña del navegador
    if (curso.titulo) {
        document.title = `${curso.titulo} | Boardroom Business School`;
    }

    // Textos principales y metadatos
    asignarTexto('curso-catalogo', curso.catalogo);
    asignarTexto('curso-titulo', curso.titulo);
    asignarTexto('curso-titulo2', curso.titulo);
    asignarTexto('curso-titulo3', curso.titulo);
    asignarTexto('curso-form-admision', curso.titulo);
    asignarTexto('curso-descripcion', curso.descripcion);
    asignarTexto('curso-fecha', curso.fecha);
    asignarTexto('curso-precio', curso.precio);
    asignarTexto('curso-meses', curso.meses);
    asignarTexto('curso-horas', curso.horas);
    asignarTexto('curso-clases', curso.clases);
    asignarTexto('curso-modalidad', curso.modalidad);
    asignarTexto('curso-certificado', curso.certificado);
    asignarTexto('curso-dc3', curso.dc3);

    // Secciones extensas (respetando acentos de tus llaves JSON)
    asignarHTML('curso-main-content', curso.mainContent);
    asignarHTML('curso-introduccion', curso['introducción']);
    asignarHTML('curso-estructura', curso.estructura);
    asignarHTML('curso-aprendizajes', curso.aprendizajes);
    asignarHTML('curso-metodologia', curso['metodología']);
    asignarHTML('curso-perfil', curso.perfil_participante);
    asignarHTML('curso-faq', curso.faq);
    asignarHTML('curso-descripcion-larga', curso.descripcion_larga);

    // Datos del docente
    asignarTexto('docente-nombre', curso.docente);

    const imgDocente = document.getElementById('docente-foto');
    if (imgDocente && curso.foto_docente) {
        // Ajusta el prefijo de la carpeta de imágenes si es necesario (ej: 'assets/images/docentes/')
        imgDocente.src = curso.foto_docente;
        imgDocente.alt = curso.docente || 'Docente';
    }

    const linkDocente = document.getElementById('docente-url');
    if (linkDocente && curso.url_docente) {
        linkDocente.href = curso.url_docente;
    }

    // Imagen principal y botón de acción del curso
    const imgCurso = document.getElementById('curso-imagen');
    if (imgCurso && curso.imagen) {
        imgCurso.src = curso.imagen;
        imgCurso.alt = curso.titulo || 'Imagen del programa';
    }

    // Imagen principal y botón de acción del curso
    const imgCurso2 = document.getElementById('curso-imagen2');
    if (imgCurso2 && curso.imagen2) {
        imgCurso2.src = curso.imagen2;
        imgCurso2.alt = curso.titulo || 'Imagen del programa';
    }

    const btnInscripcion = document.getElementById('curso-url');
    if (btnInscripcion && curso.url) {
        btnInscripcion.href = curso.url;
    }

    document.getElementById("curso-form-admision").value = curso.titulo;
    document.getElementById("curso-form-admision").readOnly = true;

    asignarTexto('docente-descripcion', curso.descripcion_docente);
}

function mostrarError(mensaje) {
    const contenedor = document.getElementById('curso-titulo') || document.body;
    if (contenedor.id === 'curso-titulo') {
        contenedor.textContent = mensaje;
    } else {
        alert(mensaje);
    }
}




document.addEventListener('DOMContentLoaded', async () => {
    // 1. Leer el parámetro "id" de la URL (ej. curso.html?id=4)
    const params = new URLSearchParams(window.location.search);
    const idCurso = Number(params.get('id'));
  
    if (!idCurso) {
      console.warn('No se especificó un ID de curso en la URL.');
      return;
    }
  
    try {
      // 2. Cargar el JSON (ajusta la ruta si está en una carpeta como 'data/cursos.json')
      const respuesta = await fetch('cursos/cursos.json');
      const cursos = await respuesta.json();
  
      // 3. Buscar el curso por ID
      const curso = cursos.find(item => item.id === idCurso);
  
      if (!curso) {
        console.error(`No se encontró ningún curso con el ID: ${idCurso}`);
        return;
      }
  
      // 4. Actualizar los Meta Tags
      actualizarMetaTags(curso);
  
      // 5. Aquí llamas a tu función actual para llenar el HTML del curso
      // renderizarCurso(curso);
  
    } catch (error) {
      console.error('Error cargando el archivo JSON:', error);
    }
  });
  
  function actualizarMetaTags(curso) {
    const urlBase = window.location.origin; // Ej: https://tusitio.com
    
    // Usa los datos de "curso.meta" si existen, o usa los campos normales como respaldo
    const titulo = curso.meta?.title || `${curso.titulo} | ${curso.catalogo}`;
    const descripcion = curso.meta?.description || curso.descripcion;
    const palabrasClave = curso.meta?.keywords || `${curso.titulo}, ${curso.catalogo}, ${curso.temas}`;
    const imagenCompleta = `${urlBase}/${curso.imagen}`;
    const urlActual = window.location.href;
  
    // Actualizar <title>
    document.title = titulo;
  
    // Función interna para asignar el atributo content de forma segura
    const setMeta = (selector, valor) => {
      const el = document.querySelector(selector);
      if (el && valor) el.setAttribute('content', valor);
    };
  
    // SEO estándar
    setMeta('meta[name="description"]', descripcion);
    setMeta('meta[name="keywords"]', palabrasClave);
    setMeta('meta[name="author"]', curso.docente);
  
    // Open Graph
    setMeta('meta[property="og:title"]', titulo);
    setMeta('meta[property="og:description"]', descripcion);
    setMeta('meta[property="og:image"]', imagenCompleta);
    setMeta('meta[property="og:url"]', urlActual);
  
    // Twitter / X
    setMeta('meta[name="twitter:title"]', titulo);
    setMeta('meta[name="twitter:description"]', descripcion);
    setMeta('meta[name="twitter:image"]', imagenCompleta);
  }