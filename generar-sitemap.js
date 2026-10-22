const fs = require('fs');
const path = require('path');

// Lista de tus páginas HTML del sitio web de Boardroom Business School
const paginas = [
    'index',
    'nosotros',
    'por-que-boardroom',
    'historia',
    'equipo',
    'claustro',
    'cohorte-cero',
    'programas',
    'diplomados',
    'programas-in-house',
    'admisiones',
    'networking',
    'congresos',
    'workshops',
    'case-competitions',
    'ferias-de-empleo',
    'conferencias-y-catedras',
    'becas',
    'incubadora',
    'contacto',
    'james-lass',
    'leticia-maldonado',
    'ricardo-bustamante',
    'diego-donadei',
    'isabel-zapata',
    'consulting',
    'cookies',
    'politica',
    'terminos',
    'bolsa-de-trabajo'
];

const dominioBase = 'https://boardroom-business.school';

// Construcción del contenido del sitemap con saltos de página y extensión .html en <loc>
let sitemapXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
sitemapXML += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

paginas.forEach(pagina => {
    // Si la página es 'index', se puede dejar como la raíz o index.html según prefieras. Aquí se maneja limpia o con .html
    const rutaLoc = pagina === 'index' ? `${dominioBase}/` : `${dominioBase}/${pagina}.html`;
    
    sitemapXML += '  <url>\n';
    sitemapXML += `    <loc>${rutaLoc}</loc>\n`;
    sitemapXML += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    sitemapXML += '    <changefreq>weekly</changefreq>\n';
    sitemapXML += '    <priority>0.8</priority>\n';
    sitemapXML += '  </url>\n\n'; // Salto de línea adicional para separar cada nodo URL
});

sitemapXML += '</urlset>';

// Guardar el archivo sitemap.xml en la raíz del workspace
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemapXML, 'utf8');

console.log('¡Sitemap generado exitosamente con extensión .html y saltos de línea por nodo!');