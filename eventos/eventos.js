const contenedorWorkshops = document.getElementById('lista-eventos');

// Reemplaza por la ruta de tu archivo JSON o URL del Web Service
const URL_WORKSHOPS = 'eventos/eventos.json';

const hoy = new Date();
const año = hoy.getFullYear();
const mes = String(hoy.getMonth() + 1).padStart(2, '0');
const dia = String(hoy.getDate()).padStart(2, '0');
const fechaHoyFormateada = `${año}-${mes}-${dia}`;

function recortarTexto(texto, limite = 100) {
if (!texto) return '';
// Limpia caracteres invisibles (\u200B) de tu JSON antes de recortar
const textoLimpio = texto.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
return textoLimpio.length > limite ? textoLimpio.slice(0, limite) + '...' : textoLimpio;
}

function formatoFecha(fecha) {
if (!fecha) return '';

// Limpia caracteres invisibles y espacios
const fechaLimpia = fecha.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

// Verifica que tenga el formato YYYY-MM-DD (con guiones)
if (!fechaLimpia.includes('-')) return fechaLimpia;

// Separa en [año, mes, dia] y lo reordena a dia/mes/año
const [año, mes, dia] = fechaLimpia.split('-');

return `${dia}/${mes}/${año}`;
}

fetch(URL_WORKSHOPS)
.then(response => response.json())
.then(workshops => {
    contenedorWorkshops.innerHTML = '';

    // Convierte en arreglo si el JSON contiene un solo objeto
    const listaWorkshops = Array.isArray(workshops) ? workshops : [workshops];

    // Mismo filtrado por fechas futuras o actuales
    //const workshopsFiltrados = listaWorkshops.filter(workshop => workshop.fecha >= fechaHoyFormateada);
    const workshopsFiltrados = workshops.filter(workshop => {
    const cumpleFecha = !workshop.fecha || workshop.fecha >= fechaHoyFormateada || workshop.fecha === 'Proximamente';
    const estaActivo = workshop.activo == 1; // Evalúa true tanto para 1 (número) como para "1" (texto)
    return cumpleFecha && estaActivo;
    });

    if (workshopsFiltrados.length === 0) {
    contenedorWorkshops.innerHTML = `<p>No hay workshops próximos programados.</p>`;
    return;
    }

    workshopsFiltrados.forEach(workshop => {
    const descripcionCorta = recortarTexto(workshop.descripcion_larga, 100);
    const card = document.createElement('div');
    card.className = 'card-evento';
    card.innerHTML = `
        <img src="${workshop.imagen}" alt="${workshop.titulo}" style="width:100%; height:150px; object-fit:cover; border-radius: 4px;">
        <h2>${workshop.titulo}</h2>
        <p><strong>Fecha:</strong> <strong class="text-danger">${formatoFecha(workshop.fecha)}</strong></p>
        
        <p><strong>Descripción:</strong> ${descripcionCorta}</p>
        <p class="main-button-red pt-5 text-center text-white">
            <a target="_self" href="${workshop.url}?id=${workshop.id}">más información</a>
        </p>
        `;
    contenedorWorkshops.appendChild(card);
    });

    // Guardamos la respuesta para la pantalla de detalle (workshops.html)
    localStorage.setItem('workshops_ws_cache', JSON.stringify(listaWorkshops));
})
.catch(error => {
    contenedorWorkshops.innerHTML = `<p>Error al cargar los workshops.</p>`;
    console.error(error);
});
