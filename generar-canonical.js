const fs = require('fs');
const path = require('path');

// 1. URL ABSOLUTA COMPLETA (Modifica según la propiedad que estés procesando en este directorio)
const DOMAIN = "https://boardroom-business.school"; // Cambia esto a tu dominio real, por ejemplo: https://tu-dominio-personalizado.com

// 2. Directorio local donde están almacenados tus archivos estáticos en VS Code
const PUBLIC_DIR = path.join(__dirname, '.'); 

function processFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        
        // Ignorar carpetas de control y dependencias
        if (file === 'node_modules' || file === '.git' || file === '.vscode') return;

        if (fs.statSync(filePath).isDirectory()) {
            processFiles(filePath);
        } else if (file.endsWith('.html')) {
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Calculamos la ruta relativa para cada página estática
            let relativePath = path.relative(PUBLIC_DIR, filePath).replace(/\\/g, '/');
            
            // Si el archivo es index.html apunta directamente a la raíz del subdominio
            const pagePath = relativePath === 'index.html' ? '' : `/${relativePath}`;
            const canonicalUrl = `${DOMAIN}${pagePath}`;
            
            const canonicalTag = `<link rel="canonical" href="${canonicalUrl}">`;
            
            // Inserción inicial si se encuentra el marcador
            if (content.includes('<!-- CANONICAL_PLACEHOLDER -->')) {
                content = content.replace('<!-- CANONICAL_PLACEHOLDER -->', canonicalTag);
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`✅ Canonical absoluto insertado en: ${relativePath} -> ${canonicalUrl}`);
            } 
            // Reemplazo y actualización automática si ya existía una etiqueta previa
            else if (content.includes('<link rel="canonical"')) {
                content = content.replace(/<link rel="canonical" href="[^"]*">/, canonicalTag);
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`🔄 Canonical absoluto actualizado en: ${relativePath} -> ${canonicalUrl}`);
            }
        }
    });
}

console.log("🚀 Iniciando generación automática de URLs Canónicas Absolutas...");
processFiles(PUBLIC_DIR);
console.log("🎉 ¡Proceso terminado con éxito!");