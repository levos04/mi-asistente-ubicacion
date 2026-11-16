const Mapa = (() => {
  let mapa, marcadorActual;
  const capa = L.layerGroup();

  function iniciar() {
    mapa = L.map('mapa').setView([20.9674, -89.5926], 12); // Mérida por defecto
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapa);
    capa.addTo(mapa);
  }

  function centrar(lat, lng, precision) {
    mapa.setView([lat, lng], 17);
    if (marcadorActual) mapa.removeLayer(marcadorActual);
    marcadorActual = L.marker([lat, lng]).addTo(mapa)
      .bindPopup('Estás aquí').openPopup();
    if (precision) L.circle([lat, lng], { radius: precision }).addTo(capa);
  }

  function pintarRegistros(registros) {
    capa.clearLayers();
    registros.forEach(r => {
      const m = L.marker([r.lat, r.lng]);
      let html = `<b>${new Date(r.fecha).toLocaleString()}</b>`;
      if (r.foto) {
        const url = URL.createObjectURL(r.foto);
        html += `<br><img src="${url}" style="width:150px">`;
      }
      m.bindPopup(html).addTo(capa);
    });
  }

  return { iniciar, centrar, pintarRegistros };
})();