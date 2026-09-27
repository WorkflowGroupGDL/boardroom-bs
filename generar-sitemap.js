const fs = require('fs');
const path = require('path');
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');

// CONFIGURACIÓN DE TU DOMINIO REAL
const BASE_URL = 'https://boardroom-business.school';

// Función para buscar todos los archivos .html recursivamente en tu proyecto
function buscarArchivosHtml(dir, listaArchivos = []) {
  const archivos = fs.readdirSync(dir);

  archivos.forEach(archivo => {
    const rutaCompleta = path.join(dir, archivo);
    const stat = fs.statSync(rutaCompleta);

    // Ignorar carpetas del sistema, dependencias y la carpeta .vscode
    if (stat.isDirectory()) {
      if (archivo !== 'node_modules' && archivo !== '.git' && archivo !== '.vscode') {
        buscarArchivosHtml(rutaCompleta, listaArchivos);
      }
    } else if (archivo.endsWith('.html')) {
      // Obtener la ruta relativa desde la raíz del proyecto
      let rutaRelativa = path.relative(__dirname, rutaCompleta).replace(/\\/g, '/');
      
      // Formatear la URL para el sitemap
      if (rutaRelativa === 'index.html') {
        rutaRelativa = ''; // Raíz
      } else {
        rutaRelativa = rutaRelativa.replace('.html', ''); // URLs limpias sin .html
      }
      
      listaArchivos.push({ url: `/${rutaRelativa}`, changefreq: 'weekly', priority: rutaRelativa === '' ? 1.0 : 0.8 });
    }
  });

  return listaArchivos;
}

(async () => {
  try {
    console.log('🔍 Escaneando archivos HTML locales...');
    const enlaces = buscarArchivosHtml(__dirname);

    if (enlaces.length === 0) {
      console.log('❌ No se encontraron archivos HTML en la raíz del proyecto.');
      return;
    }

    console.log(`✨ Se encontraron ${enlaces.length} páginas locales. Generando sitemap...`);

    const stream = new SitemapStream({ hostname: BASE_URL });
    const xmlBuffer = await streamToPromise(Readable.from(enlaces).pipe(stream));
    
    // Guardar el sitemap.xml en la raíz
    fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), xmlBuffer.toString());
    
    console.log('🎉 ¡Sitemap generado con ÉXITO de forma local para todas tus páginas!');
    enlaces.forEach(e => console.log(`   👉 ${BASE_URL}${e.url}`));

  } catch (error) {
    console.error('❌ Error generando el sitemap:', error);
  }
})();
