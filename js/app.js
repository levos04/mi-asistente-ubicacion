const $ = id => document.getElementById(id);
const estado = msg => ($('estado').textContent = msg);
let ultimaPosicion = null;

// ---------- Inicio ----------
window.addEventListener('load', async () => {
  await DB.abrir();
  Mapa.iniciar();
  await refrescar();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
  actualizarConsentimiento();
});

// ---------- Consentimiento ----------
function consentimiento() {
  return $('chkConsentimiento').checked;
}
function actualizarConsentimiento() {
  const ok = consentimiento();
  $('btnUbicacion').disabled = !ok;
  $('btnCamara').disabled = !ok;
}
$('chkConsentimiento').addEventListener('change', actualizarConsentimiento);

// ---------- Geolocalización ----------
$('btnUbicacion').addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    return estado('Tu navegador no soporta geolocalización.');
  }
  estado('Obteniendo ubicación...');
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      ultimaPosicion = { lat, lng, precision: accuracy };
      Mapa.centrar(lat, lng, accuracy);
      await DB.agregar({ lat, lng, precision: accuracy, fecha: Date.now(), foto: null });
      estado(`Ubicación guardada (±${Math.round(accuracy)} m)`);
      refrescar();
    },
    err => {
      const msgs = {
        1: 'Permiso de ubicación denegado. Actívalo en la configuración del navegador (ícono del candado).',
        2: 'No se pudo determinar tu posición.',
        3: 'Se agotó el tiempo de espera.'
      };
      estado(msgs[err.code] || 'Error de geolocalización.');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
});

// ---------- Cámara ----------
$('btnCamara').addEventListener('click', async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    return estado('Tu navegador no soporta acceso a la cámara.');
  }
  try {
    await Camara.abrir();
    $('zonaCamara').hidden = false;
    estado('Cámara lista.');
  } catch (e) {
    const msgs = {
      NotAllowedError: 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.',
      NotFoundError: 'No se encontró ninguna cámara.',
      NotReadableError: 'La cámara está siendo usada por otra aplicación.'
    };
    estado(msgs[e.name] || 'No se pudo abrir la cámara.');
  }
});

$('btnCerrarCamara').addEventListener('click', () => {
  Camara.cerrar();
  $('zonaCamara').hidden = true;
});

$('btnFoto').addEventListener('click', async () => {
  const blob = await Camara.capturar();
  // Si no hay ubicación previa, pedirla para asociar la foto
  const guardar = async (lat, lng, precision) => {
    await DB.agregar({ lat, lng, precision, fecha: Date.now(), foto: blob });
    estado('Foto guardada con su ubicación.');
    refrescar();
  };
  if (ultimaPosicion) {
    guardar(ultimaPosicion.lat, ultimaPosicion.lng, ultimaPosicion.precision);
  } else {
    navigator.geolocation.getCurrentPosition(
      p => guardar(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
      () => guardar(null, null, null)
    );
  }
});

let urlsActivas = [];

function nombreArchivo(r) {
  const f = new Date(r.fecha);
  const pad = n => String(n).padStart(2, '0');
  return `foto_${f.getFullYear()}${pad(f.getMonth() + 1)}${pad(f.getDate())}_` +
         `${pad(f.getHours())}${pad(f.getMinutes())}${pad(f.getSeconds())}.jpg`;
}

function descargarFoto(r) {
  const url = URL.createObjectURL(r.foto);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo(r);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pintarGaleria(regs) {
  // Liberar URLs anteriores para no consumir memoria
  urlsActivas.forEach(u => URL.revokeObjectURL(u));
  urlsActivas = [];

  const cont = $('galeria');
  cont.innerHTML = '';
  const conFoto = regs.filter(r => r.foto);

  $('galeriaVacia').hidden = conFoto.length > 0;
  $('btnDescargarTodas').hidden = conFoto.length === 0;

  conFoto.forEach(r => {
    const url = URL.createObjectURL(r.foto);
    urlsActivas.push(url);

    const card = document.createElement('figure');
    card.className = 'foto-card';

    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Foto del ' + new Date(r.fecha).toLocaleString();
    img.loading = 'lazy';

    const cap = document.createElement('figcaption');
    const coords = r.lat != null ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` : 'sin ubicación';
    cap.textContent = `${new Date(r.fecha).toLocaleString()} · ${coords}`;

    const acciones = document.createElement('div');
    acciones.className = 'acciones';

    const bDesc = document.createElement('button');
    bDesc.textContent = '⬇ Descargar';
    bDesc.onclick = () => descargarFoto(r);

    const bDel = document.createElement('button');
    bDel.textContent = '🗑 Eliminar';
    bDel.className = 'peligro';
    bDel.onclick = async () => {
      if (confirm('¿Eliminar esta foto?')) { await DB.eliminar(r.id); refrescar(); }
    };

    acciones.append(bDesc, bDel);
    card.append(img, cap, acciones);
    cont.appendChild(card);
  });
}

$('btnDescargarTodas').addEventListener('click', async () => {
  const regs = (await DB.todos()).filter(r => r.foto);
  for (const r of regs) {
    descargarFoto(r);
    await new Promise(res => setTimeout(res, 400)); // evita que el navegador bloquee descargas múltiples
  }
});

// ---------- Lista y borrado ----------
async function refrescar() {
  const regs = await DB.todos();
  const ul = $('listaRegistros');
  ul.innerHTML = '';
  regs.reverse().forEach(r => {
    const li = document.createElement('li');
    const coords = r.lat != null ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` : 'sin ubicación';
    li.innerHTML = `<span>${new Date(r.fecha).toLocaleString()} — ${coords} ${r.foto ? '📷' : ''}</span>`;
    const b = document.createElement('button');
    b.textContent = '🗑';
    b.onclick = async () => { await DB.eliminar(r.id); refrescar(); };
    li.appendChild(b);
    ul.appendChild(li);
  });
  pintarGaleria(regs);
  Mapa.pintarRegistros(regs.filter(r => r.lat != null));
}

$('btnBorrarTodo').addEventListener('click', async () => {
  if (confirm('¿Eliminar todos tus ubicaciones y fotos guardadas?')) {
    await DB.limpiar();
    refrescar();
    estado('Datos eliminados.');
  }
});

// ---------- Instalación de la PWA ----------
let promptInstalacion = null;

const yaInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  promptInstalacion = e;
  if (!yaInstalada()) $('btnInstalar').hidden = false;
});

$('btnInstalar').addEventListener('click', async () => {
  if (!promptInstalacion) return;
  promptInstalacion.prompt();
  const { outcome } = await promptInstalacion.userChoice;
  estado(outcome === 'accepted'
    ? 'Instalando la aplicación...'
    : 'Instalación cancelada. Puedes instalarla cuando quieras.');
  promptInstalacion = null;
  $('btnInstalar').hidden = true;
});

window.addEventListener('appinstalled', () => {
  $('btnInstalar').hidden = true;
  estado('✅ Aplicación instalada correctamente.');
});

// iOS no dispara beforeinstallprompt: mostrar instrucciones manuales
if (esIOS && !yaInstalada()) {
  $('ayudaIOS').hidden = false;
}

// Apagar la cámara si la pestaña se oculta
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Camara.cerrar(); $('zonaCamara').hidden = true; }
});