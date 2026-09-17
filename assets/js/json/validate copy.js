function loadXMLDoc() {
    fetch('./assets/js/json/certs.xml')
        .then(response => response.text())
        .then(data => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, "text/xml");
            searchBooks(xmlDoc);
        })
        .catch(error => console.error('Error fetching XML:', error));
}

function searchBooks(xmlDoc) {

    document.getElementById('resultado').innerHTML = '';
    document.getElementById('result_id').innerHTML = 'ID: ';
    document.getElementById('result_nombre').innerHTML = 'Nombre: ';
    document.getElementById('result_curso').innerHTML = 'Programa: ';
    document.getElementById('result_fecha').innerHTML = 'Fecha concluida: ';
    document.getElementById('result_horas').innerHTML = 'Horas totales: ';
    document.getElementById('result_Instructor').innerHTML = 'Instructor(es): ';
    document.getElementById('result_dc3').innerHTML = 'DC-3: ';
    document.getElementById('result_certificado').innerHTML = 'Certificado: ';
    document.getElementById('result_negocio').innerHTML = 'Negocio/Empresa: ';
    document.getElementById('result_ciudad').innerHTML = 'Ciudad: ';
    document.getElementById('result_curp').innerHTML = 'Curp: ';
    

    const searchTerm = document.getElementById("searchTerm").value.toLowerCase();
    const books = xmlDoc.getElementsByTagName("cert");
    const results = [];

    //if (searchTerm.length !== 36) then;

    for (let i = 0; i < books.length; i++) {
        const id = books[i].getElementsByTagName("id")[0].textContent.toLowerCase();
        const nombre = books[i].getElementsByTagName("nombre")[0].textContent.toLowerCase();
        const curso = books[i].getElementsByTagName("curso")[0].textContent.toLowerCase();
        const fecha = books[i].getElementsByTagName("fecha")[0].textContent.toLowerCase();
        const horas = books[i].getElementsByTagName("horas")[0].textContent.toLowerCase();
        const Instructor = books[i].getElementsByTagName("Instructor")[0].textContent.toLowerCase();
        const dc3 = books[i].getElementsByTagName("dc3")[0].textContent.toLowerCase();
        const certificado = books[i].getElementsByTagName("certificado")[0].textContent.toLowerCase();
        const negocio = books[i].getElementsByTagName("negocio")[0].textContent.toLowerCase();
        const ciudad = books[i].getElementsByTagName("ciudad")[0].textContent.toLowerCase();
        const curp = books[i].getElementsByTagName("curp")[0].textContent.toLowerCase();

        if (id.includes(searchTerm)) {// || nombre.includes(searchTerm)) {
            results.push({
                id: books[i].getElementsByTagName("id")[0].textContent,
                nombre: books[i].getElementsByTagName("nombre")[0].textContent,
                curso: books[i].getElementsByTagName("curso")[0].textContent,
                fecha: books[i].getElementsByTagName("fecha")[0].textContent,
                horas: books[i].getElementsByTagName("horas")[0].textContent,
                Instructor: books[i].getElementsByTagName("Instructor")[0].textContent,
                dc3: books[i].getElementsByTagName("dc3")[0].textContent,
                certificado: books[i].getElementsByTagName("certificado")[0].textContent,
                negocio: books[i].getElementsByTagName("negocio")[0].textContent,
                ciudad: books[i].getElementsByTagName("ciudad")[0].textContent,
                curp: books[i].getElementsByTagName("curp")[0].textContent
            });
        }
    }
    if (searchTerm.length === 36) {
        // Code to execute if condition is true
        displayResults(results);
    } else {
        // Code to execute if condition is false
        alert("No results found.");
    }
}

function displayResults(results) {
    const resultsTable = document.getElementById("resultsTable");

    // Clear previous results
    while (resultsTable.rows.length > 1) {
        resultsTable.deleteRow(1);
    }

    results.forEach(result => {
        // const row = resultsTable.insertRow();
        // const cellTitle = row.insertCell(0);
        // const cellAuthor = row.insertCell(1);
        // const cellcurso = row.insertCell(2);
        // const cellfecha = row.insertCell(3);
        // const cellhoras = row.insertCell(4);
        // const cellInstructor = row.insertCell(5);
        // const celldc3 = row.insertCell(6);
        // const cellcertificado = row.insertCell(7);
        // const cellnegocio = row.insertCell(8);
        // const cellciudad = row.insertCell(9);

        // cellTitle.textContent = result.id;
        // cellAuthor.textContent = result.nombre;

        // cellcurso.textContent = result.curso;
        // cellfecha.textContent = result.fecha;
        // cellhoras.textContent = result.horas;
        // cellInstructor.textContent = result.Instructor;
        // celldc3.textContent = result.dc3;
        // cellcertificado.textContent = result.certificado;
        // cellnegocio.textContent = result.negocio;
        // cellciudad.textContent = result.ciudad;

        document.getElementById('resultado').innerHTML = 'Resultado';
        document.getElementById('result_id').innerHTML = 'ID: ' + result.id;
        document.getElementById('result_nombre').innerHTML = 'Nombre: ' + result.nombre;
        document.getElementById('result_curso').innerHTML = 'Programa: ' + result.curso;
        document.getElementById('result_fecha').innerHTML = 'Fecha concluida: ' + result.fecha;
        document.getElementById('result_horas').innerHTML = 'Horas totales: ' + result.horas;
        document.getElementById('result_Instructor').innerHTML = 'Instructor(es): ' + result.Instructor + ' / #Registro Instructor Externo STPS: LAJA-661002-R85-0005';
        document.getElementById('result_dc3').innerHTML = 'DC-3: ' + result.dc3;
        document.getElementById('result_certificado').innerHTML = 'Certificado: ' + result.certificado;
        document.getElementById('result_negocio').innerHTML = 'Negocio/Empresa: ' + result.negocio;
        document.getElementById('result_ciudad').innerHTML = 'Ciudad: ' + result.ciudad;
        document.getElementById('result_curp').innerHTML = 'Curp: ' + result.ciudad;

    });

    if (results.length === 0) {
        alert("No results found.");
    }
}