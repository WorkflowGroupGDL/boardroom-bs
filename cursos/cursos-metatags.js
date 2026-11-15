
  
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificar el ID en la URL
    const params = new URLSearchParams(window.location.search);
    const idCurso = Number(params.get('id'));
  
    if (!idCurso) {
      console.error('❌ ERROR: Falta el parámetro ?id= en la URL. Ejemplo: pagina.html?id=4');
      return;
    }
  
    // ⚠️ VERIFICA QUE ESTA RUTA SEA LA CORRECTA EN TU PROYECTO
    const RUTA_JSON = 'cursos/cursos.json';
  
    try {
      const respuesta = await fetch(RUTA_JSON);
      
      if (!respuesta.ok) {
        throw new Error(`No se encontró el archivo JSON en "${RUTA_JSON}" (Status: ${respuesta.status})`);
      }
  
      const datos = await respuesta.json();
      const listaCursos = Array.isArray(datos) ? datos : [datos];
      const curso = listaCursos.find(item => Number(item.id) === idCurso);
  
      if (!curso) {
        console.error(`❌ ERROR: El JSON cargó bien, pero no existe ningún curso con id: ${idCurso}`);
        return;
      }
  
      console.log('✅ Curso encontrado:', curso.titulo);
      aplicarMetaTags(curso);
  
    } catch (error) {
      console.error('❌ FALLO CRÍTICO:', error.message);
    }
  });
  
  function aplicarMetaTags(curso) {
    const dominio = window.location.origin;
    const titulo = curso.meta?.title || `${curso.titulo} | Boardroom Business School`;
    const descripcion = curso.meta?.description || curso.descripcion || '';
    const keywords = curso.meta?.keywords || `${curso.titulo}, ${curso.catalogo}, ${curso.temas}`;
    const imagen = curso.meta?.og_image || (curso.imagen ? `${dominio}/${curso.imagen}` : '');
  
    // Cambiar título de la pestaña
    document.title = titulo;
  
    // Función que actualiza la etiqueta o la crea si no existe en el <head>
    const escribirMeta = (atributo, clave, valor) => {
      if (!valor) return;
      let tag = document.querySelector(`meta[${atributo}="${clave}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(atributo, clave);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', valor);
    };
  
    escribirMeta('name', 'description', descripcion);
    escribirMeta('name', 'keywords', keywords);
    escribirMeta('name', 'author', curso.docente);
  
    escribirMeta('property', 'og:title', titulo);
    escribirMeta('property', 'og:description', descripcion);
    escribirMeta('property', 'og:image', imagen);
    escribirMeta('property', 'og:url', window.location.href);
  
    escribirMeta('name', 'twitter:title', titulo);
    escribirMeta('name', 'twitter:description', descripcion);
    escribirMeta('name', 'twitter:image', imagen);
  
    console.log('✅ Meta tags actualizadas en el <head>');
  }
  