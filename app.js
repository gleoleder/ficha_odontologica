// ═══════════════════════════════════════════════════════════════
//  Ficha Odontológica — lógica de la app
//  · Odontograma interactivo (FDI) con estados por diente
//  · Cálculo automático del índice COPD (OMS)
//  · Guardado local (IndexedDB) + sincronización a Google Sheets
//  · Impresión / PDF idéntico al modelo legal
// ═══════════════════════════════════════════════════════════════

// ── Nomenclatura oficial de la ficha ───────────────────────────
//  Cada código tiene número, etiqueta y color para el odontograma.
//  Paleta PASTEL: colores suaves para la corona del odontograma y para
//  el cuadrito de color de la tabla de nomenclatura. Texto oscuro para
//  que el número del código se lea bien sobre el tono claro.
const ESTADOS = {
  0:  { label: 'Sano',                 color: '#ffffff', text: '#333' },
  1:  { label: 'Caries',               color: '#f6a6a6', text: '#5a1313' },
  2:  { label: 'Patología Pulpar',     color: '#f3aecd', text: '#5a1330' },
  3:  { label: 'Proceso Periapical',   color: '#d7b3e6', text: '#3d1652' },
  4:  { label: 'Patología Periodontal',color: '#b9b1e8', text: '#241a55' },
  5:  { label: 'Perdido Extraído',     color: '#9aa3ad', text: '#1c2127' },
  6:  { label: 'Obturado',             color: '#a7c8ef', text: '#103154' },
  7:  { label: 'No Erupcionado',       color: '#cfd8de', text: '#2e373d' },
  8:  { label: 'Exodoncia Indicada',   color: '#f7c2a3', text: '#5c2a10' },
  9:  { label: 'Mal Posición',         color: '#f7e4a1', text: '#5a4a10' },
  10: { label: 'Supernumerarios',      color: '#aee0bb', text: '#16431f' },
  11: { label: 'No Clasificado',       color: '#e0e0e0', text: '#333' }
};

// ── Numeración FDI tal como aparece en la ficha ────────────────
//  Permanentes superiores: 18→11 | 21→28
//  Permanentes inferiores: 48→41 | 31→38
//  Temporales (leche) superiores: 55→51 | 61→65
//  Temporales inferiores:         85→81 | 71→75
const FILAS = [
  { tipo: 'perm', dientes: [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28] },
  { tipo: 'temp', dientes: [55,54,53,52,51, 61,62,63,64,65] },
  { tipo: 'temp', dientes: [85,84,83,82,81, 71,72,73,74,75] },
  { tipo: 'perm', dientes: [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38] }
];

// Estado del odontograma en memoria: { '18': 0, '17': 1, ... }
let odonto = {};
let fichaActualId = null;

// ── Dibujo anatómico de cada diente (SVG) ──────────────────────
//  El tipo se deduce del último dígito del número FDI:
//    1,2 → incisivo · 3 → canino · 4,5 → premolar · 6,7,8 → molar
//  Cada forma tiene una CORONA (rect superior, la parte que se marca
//  con color según el estado) y RAÍCES dibujadas debajo.
//  En arcadas superiores el diente se voltea (raíces hacia arriba).
function tipoDiente(num) {
  const d = num % 10;
  if (d === 1 || d === 2) return 'incisivo';
  if (d === 3)            return 'canino';
  if (d === 4 || d === 5) return 'premolar';
  return 'molar';
}

// Devuelve el SVG de un diente. `fill`=color de corona, `arriba`=arcada superior.
function svgDiente(tipo, fill, text, code, arriba, num) {
  // Geometría en viewBox 0..40 (ancho) × 0..56 (alto), corona abajo, raíz arriba.
  // root = trazos de raíz (gris) · crown = contorno de corona · surf = relieve oclusal
  const C = '#3a3a3a';          // contorno
  const R = '#e9d9c3';          // raíz (marfil)
  let root, crown, surf = '';

  if (tipo === 'molar') {
    root = `<path d="M8 22 C6 10 9 2 13 2 C16 2 17 9 18 18
                     M32 22 C34 10 31 2 27 2 C24 2 23 9 22 18
                     M20 20 C19 8 20 2 20 2 C20 2 21 8 20 20" fill="none" stroke="${C}" stroke-width="1.6"/>`;
    crown = `<rect x="6" y="20" width="28" height="30" rx="7" fill="${fill}" stroke="${C}" stroke-width="1.8"/>`;
    surf  = `<path d="M13 30 Q20 34 27 30 M13 40 Q20 36 27 40 M20 27 V44" fill="none" stroke="${C}" stroke-width="1.1" opacity=".5"/>`;
  } else if (tipo === 'premolar') {
    // Los PRIMEROS premolares superiores (14 y 24) tienen DOS raíces.
    // Una de ellas se dibuja con el contorno PUNTEADO:
    //   · 14 → raíz derecha (en pantalla, x alto) punteada
    //   · 24 → raíz izquierda (en pantalla, x bajo) punteada
    if (num === 14 || num === 24) {
      const izqPunteada = (num === 24);   // 24: izquierda · 14: derecha
      const dash = `stroke-dasharray="2.5 2"`;
      const rootIzq = `<path d="M15 22 C12 9 15 3 17 3 C19 3 19 12 19 21" fill="${R}" stroke="${C}" stroke-width="1.6" ${izqPunteada ? dash : ''}/>`;
      const rootDer = `<path d="M25 22 C28 9 25 3 23 3 C21 3 21 12 21 21" fill="${R}" stroke="${C}" stroke-width="1.6" ${izqPunteada ? '' : dash}/>`;
      root = rootIzq + rootDer;
    } else {
      root = `<path d="M14 22 C12 8 16 2 20 2 C24 2 28 8 26 22" fill="none" stroke="${C}" stroke-width="1.8"/>`;
    }
    crown = `<path d="M9 24 Q9 50 20 50 Q31 50 31 24 Q31 19 20 19 Q9 19 9 24 Z" fill="${fill}" stroke="${C}" stroke-width="1.8"/>`;
    surf  = `<path d="M14 31 Q20 35 26 31 M20 28 V40" fill="none" stroke="${C}" stroke-width="1.1" opacity=".5"/>`;
  } else if (tipo === 'canino') {
    root = `<path d="M18 22 C15 6 19 1 20 1 C21 1 25 6 22 22" fill="none" stroke="${C}" stroke-width="1.8"/>`;
    crown = `<path d="M20 50 C31 46 30 24 24 20 Q20 18 16 20 C10 24 9 46 20 50 Z" fill="${fill}" stroke="${C}" stroke-width="1.8"/>`;
  } else { // incisivo
    root = `<path d="M17 22 C15 8 18 2 20 2 C22 2 25 8 23 22" fill="none" stroke="${C}" stroke-width="1.8"/>`;
    crown = `<path d="M11 24 Q11 50 20 50 Q29 50 29 24 Q29 20 20 20 Q11 20 11 24 Z" fill="${fill}" stroke="${C}" stroke-width="1.8"/>`;
  }

  // Las raíces se pintan con relleno marfil detrás del trazo
  const rootFill = root.replace(/fill="none"/g, `fill="${R}"`);

  // Forma del diente (raíz + corona + relieve), SIN el número.
  const forma = `<g>${rootFill}${root}${crown}${surf}</g>`;
  // La geometría base tiene la CORONA abajo y la RAÍZ arriba → correcto
  // para la arcada SUPERIOR. Para la INFERIOR se voltea (corona arriba).
  const formaOrientada = arriba
    ? forma
    : `<g transform="translate(0,56) scale(1,-1)">${forma}</g>`;

  // El número del código se dibuja aparte (nunca volteado) sobre la corona,
  // que tras orientar queda: abajo (y≈37) en superior, arriba (y≈22) en inferior.
  const labelY = arriba ? 39 : 23;
  // paint-order="stroke" dibuja el contorno blanco DEBAJO del relleno,
  // creando un halo que hace legible el número sobre cualquier color.
  const label = code ? `<text x="20" y="${labelY}" text-anchor="middle"
      dominant-baseline="middle" font-size="12" font-weight="700"
      paint-order="stroke" stroke="#fff" stroke-width="2.6"
      stroke-linejoin="round" fill="${text}">${code}</text>` : '';

  return `<svg viewBox="0 0 40 56" class="diente-svg">${formaOrientada}${label}</svg>`;
}

// ── Construir el odontograma en el DOM ─────────────────────────
function renderOdontograma() {
  const cont = document.getElementById('odontograma');
  cont.innerHTML = '';

  FILAS.forEach((fila, idx) => {
    const arriba = idx <= 1;   // las dos primeras filas son arcada superior
    const row = document.createElement('div');
    row.className = 'odo-fila ' + fila.tipo + (arriba ? ' arriba' : ' abajo');

    fila.dientes.forEach((num, i) => {
      // separador visual entre hemiarcadas (la ficha tiene una línea al medio)
      const mitad = fila.dientes.length / 2;
      if (i === mitad) {
        const sep = document.createElement('div');
        sep.className = 'odo-sep';
        row.appendChild(sep);
      }

      const code = odonto[num] || 0;
      const est  = ESTADOS[code];
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'diente';
      d.dataset.num = num;
      d.title = `${num} — ${est.label}`;
      const svg = svgDiente(tipoDiente(num), est.color, est.text, code, arriba, num);
      // En arcada superior el número va arriba; en inferior, abajo (como la ficha)
      d.innerHTML = arriba
        ? `<span class="diente-num">${num}</span>${svg}`
        : `${svg}<span class="diente-num">${num}</span>`;
      d.addEventListener('click', () => abrirModalDiente(num));
      row.appendChild(d);
    });

    cont.appendChild(row);
  });

  calcularCOPD();
}

// ── Tabla de nomenclatura con su cuadrito de color ─────────────
//  Se genera desde ESTADOS para que los colores SIEMPRE coincidan
//  con los del odontograma. Códigos 0–5 a la izquierda, 6–11 derecha.
function renderNomenclatura() {
  const body = document.getElementById('nomen-body');
  if (!body) return;
  const swatch = c => `<span class="nomen-color" style="background:${c}"></span>`;
  let html = '';
  for (let i = 0; i <= 5; i++) {
    const izq = ESTADOS[i], der = ESTADOS[i + 6];
    html += `<tr>
      <td>${swatch(izq.color)}${izq.label}</td><td>=${i}</td>
      <td>${swatch(der.color)}${der.label}</td><td>=${i + 6}</td>
    </tr>`;
  }
  body.innerHTML = html;
}

// ── Modal para elegir estado del diente ────────────────────────
function abrirModalDiente(num) {
  document.getElementById('modal-diente-num').textContent = num;
  const cont = document.getElementById('modal-opciones');
  cont.innerHTML = '';
  Object.entries(ESTADOS).forEach(([code, est]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.innerHTML = `<span class="nomen-color" style="background:${est.color}"></span><b>${code}</b> ${est.label}`;
    if ((odonto[num] || 0) == code) b.classList.add('sel');
    b.addEventListener('click', () => {
      odonto[num] = Number(code);
      document.getElementById('diente-modal').classList.add('hidden');
      renderOdontograma();
    });
    cont.appendChild(b);
  });
  document.getElementById('diente-modal').classList.remove('hidden');
}

// ── Cálculo del índice COPD (OMS) ──────────────────────────────
//  METODOLOGÍA OMS (verificada):
//
//  CPO-D (dientes PERMANENTES) — se consideran 28 dientes, EXCLUYENDO
//  los terceros molares (18,28,38,48 / muelas del juicio):
//    C (Cariados)  = caries activa / patología pulpar / periapical → códigos 1,2,3
//    P (Perdidos)  = extraído por caries (5) + exodoncia indicada (8)
//    O (Obturados) = restaurado → código 6
//    Índice CPO-D individual = C + P + O   (suma directa por paciente)
//
//  ceo-d (dientes TEMPORALES / de leche) — la "e" son SOLO dientes ya
//  extraídos por caries; las piezas ausentes por exfoliación natural se
//  excluyen, por eso la exodoncia indicada (8) NO suma en temporales:
//    c = cariado (1,2,3) · e = extraído por caries (5) · o = obturado (6)
//
//  Rangos de severidad OMS:
//    0,0–1,1 muy bajo · 1,2–2,6 bajo · 2,7–4,4 moderado · 4,5–6,5 alto
const TERCEROS_MOLARES = new Set([18, 28, 38, 48]);

function calcularCOPD() {
  const permSet = new Set();
  // Permanentes EXCLUYENDO terceros molares (estándar OMS = 28 dientes)
  FILAS.filter(f => f.tipo === 'perm')
       .forEach(f => f.dientes.forEach(d => { if (!TERCEROS_MOLARES.has(d)) permSet.add(d); }));
  const tempSet = new Set();
  FILAS.filter(f => f.tipo === 'temp').forEach(f => f.dientes.forEach(d => tempSet.add(d)));

  let C = 0, P = 0, O = 0;   // permanentes (mayúsculas)
  let c = 0, e = 0, o = 0;   // temporales (minúsculas: cariado, extraído, obturado)

  for (const [num, code] of Object.entries(odonto)) {
    const n = Number(num);
    const cariado  = [1, 2, 3].includes(code);
    const obturado = code === 6;
    if (permSet.has(n)) {
      // En permanentes: perdido = extraído (5) + exodoncia indicada (8)
      if (cariado)               C++;
      if (code === 5 || code === 8) P++;
      if (obturado)              O++;
    } else if (tempSet.has(n)) {
      // En temporales: e = SOLO extraído por caries (5), NO exodoncia indicada
      if (cariado)   c++;
      if (code === 5) e++;
      if (obturado)  o++;
    }
  }

  const index = C + P + O;   // índice CPO-D individual = suma directa

  document.getElementById('COPD-C').textContent = C;
  document.getElementById('COPD-P').textContent = P;
  document.getElementById('COPD-O').textContent = O;
  document.getElementById('copd-c').textContent = c;
  document.getElementById('copd-e').textContent = e;
  document.getElementById('copd-o').textContent = o;

  document.getElementById('copd-index').textContent = index.toFixed(1).replace('.', ',');
  const rangoAuto = rangoCOPD(index);
  // Si el usuario marcó un óvalo a mano, ese manda; si no, el calculado.
  const rango = omsManual || rangoAuto;
  document.getElementById('copd-rango').textContent = rango ? `(${rango})` : '';

  // marcar el dot de la tabla OMS correspondiente
  document.querySelectorAll('.oms-dot').forEach(td => {
    td.classList.toggle('on', td.dataset.r === rango);
  });
}

// Rango OMS marcado manualmente (null = automático según COPD calculado)
let omsManual = null;

// Hace clicables los óvalos de la tabla OMS
function initOmsClick() {
  document.querySelectorAll('.oms-dot').forEach(td => {
    td.addEventListener('click', () => {
      // clic en el ya marcado a mano → volver a automático
      omsManual = (omsManual === td.dataset.r) ? null : td.dataset.r;
      calcularCOPD();
    });
  });
}

function rangoCOPD(v) {
  if (v <= 1.1) return 'muy bajo';
  if (v <= 2.6) return 'bajo';
  if (v <= 4.4) return 'moderado';
  return 'alto';
}

// ── Serializar / cargar formulario ─────────────────────────────
function recolectarFicha() {
  const form = document.getElementById('ficha-form');
  const data = {};
  new FormData(form).forEach((v, k) => { data[k] = v; });
  // checkboxes no aparecen en FormData si están desmarcados → forzar bool
  ['cepillo_comida','cepillo_ocasional','cepillo_nunca'].forEach(k => {
    data[k] = form.elements[k].checked;
  });
  data.odonto = { ...odonto };
  data.oms_manual = omsManual;   // rango OMS marcado a mano (o null)
  if (fichaActualId) data.id = fichaActualId;
  return data;
}

function cargarFicha(data) {
  const form = document.getElementById('ficha-form');
  form.reset();
  odonto = { ...(data.odonto || {}) };
  omsManual = data.oms_manual || null;
  fichaActualId = data.id || null;

  for (const [k, v] of Object.entries(data)) {
    const el = form.elements[k];
    if (!el) continue;
    // Grupo de radios (varios elementos con el mismo name) → RadioNodeList
    if (el instanceof RadioNodeList) {
      [...el].forEach(r => { r.checked = (r.value === v); });
    } else if (el.type === 'checkbox') {
      el.checked = !!v;
    } else if (el.type === 'radio') {
      el.checked = (el.value === v);
    } else {
      el.value = v ?? '';
    }
  }
  renderOdontograma();
}

function limpiarFicha() {
  document.getElementById('ficha-form').reset();
  odonto = {};
  omsManual = null;
  fichaActualId = null;
  renderOdontograma();
  setEstado('');
}

// ── Guardar ────────────────────────────────────────────────────
async function guardar() {
  const data = recolectarFicha();
  if (!data.ap_paterno && !data.nombre) {
    setEstado('⚠ Falta al menos el apellido o nombre del paciente', true);
    return;
  }
  const id = await DB.saveFicha(data);
  fichaActualId = id;
  setEstado('💾 Guardado localmente.');
  // sincronizar en la nube si hay URL configurada
  syncFichaNube({ ...data, id });
}

function setEstado(msg, warn) {
  const el = document.getElementById('estado-guardado');
  el.textContent = msg;
  el.classList.toggle('warn', !!warn);
}

// ── Sincronización con Google Sheets (Apps Script) ─────────────
function getSheetsUrl() {
  return localStorage.getItem('FICHA_SHEETS_URL')
      || (typeof SHEETS_URL !== 'undefined' ? SHEETS_URL : '');
}

async function syncFichaNube(ficha) {
  const url = getSheetsUrl();
  if (!url) return;
  try {
    const body = new URLSearchParams();
    body.set('action', 'saveFicha');
    body.set('data', JSON.stringify(serializarParaNube(ficha)));
    await fetch(url, { method: 'POST', body });
    setEstado('☁ Guardado local + sincronizado en la nube.');
  } catch (err) {
    setEstado('💾 Guardado local (sin conexión a la nube).', true);
  }
}

// Aplana el odontograma a texto legible para la hoja de cálculo
function serializarParaNube(f) {
  const odontoTxt = Object.entries(f.odonto || {})
    .filter(([, c]) => c)  // omitir sanos
    .map(([num, c]) => `${num}:${c}(${ESTADOS[c]?.label || ''})`)
    .join(' | ');
  return {
    ...f,
    odonto_texto: odontoTxt,
    copd: document.getElementById('copd-index').textContent,
    copd_rango: (document.getElementById('copd-rango').textContent || '').replace(/[()]/g, '')
  };
}

// ── Lista de pacientes ─────────────────────────────────────────
async function renderLista(query = '') {
  const cont = document.getElementById('lista-fichas');
  const fichas = await DB.searchFichas(query);
  if (!fichas.length) {
    cont.innerHTML = '<p class="vacio">No hay fichas guardadas todavía.</p>';
    return;
  }
  cont.innerHTML = '';
  fichas.forEach(f => {
    const nombre = `${f.ap_paterno || ''} ${f.ap_materno || ''} ${f.nombre || ''}`.trim() || '(sin nombre)';
    const fecha = f.created_at ? new Date(f.created_at).toLocaleDateString('es-BO') : '';
    const card = document.createElement('div');
    card.className = 'ficha-card';
    card.innerHTML = `
      <div class="ficha-info">
        <b>${nombre}</b>
        <small>Edad: ${f.edad || '—'} · ${fecha}</small>
      </div>
      <div class="ficha-acts">
        <button class="btn small" data-abrir="${f.id}">Abrir</button>
        <button class="btn small ghost" data-print="${f.id}" title="Imprimir esta ficha">🖨</button>
        <button class="btn small ghost" data-del="${f.id}" title="Eliminar">🗑</button>
      </div>`;
    cont.appendChild(card);
  });

  cont.querySelectorAll('[data-abrir]').forEach(b =>
    b.addEventListener('click', async () => {
      const f = await DB.getFicha(Number(b.dataset.abrir));
      cargarFicha(f);
      mostrarVista('ficha');
    }));
  // Imprimir una ficha desde la lista: se carga, se muestra y se imprime
  cont.querySelectorAll('[data-print]').forEach(b =>
    b.addEventListener('click', async () => {
      const f = await DB.getFicha(Number(b.dataset.print));
      cargarFicha(f);
      mostrarVista('ficha');
      // esperar a que el odontograma y el DOM se pinten antes de imprimir
      setTimeout(() => window.print(), 150);
    }));
  cont.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', async () => {
      if (confirm('¿Eliminar esta ficha de este dispositivo?')) {
        await DB.deleteFicha(Number(b.dataset.del));
        renderLista(document.getElementById('buscar').value);
      }
    }));
}

// ── Navegación entre vistas ────────────────────────────────────
function mostrarVista(v) {
  document.getElementById('view-ficha').classList.toggle('hidden', v !== 'ficha');
  document.getElementById('view-lista').classList.toggle('hidden', v !== 'lista');
  if (v === 'lista') renderLista();
}

// ── Inicialización ─────────────────────────────────────────────
async function init() {
  await DB.open();
  renderNomenclatura();
  renderOdontograma();
  initOmsClick();

  document.getElementById('nav-nueva').addEventListener('click', () => { limpiarFicha(); mostrarVista('ficha'); });
  document.getElementById('nav-lista').addEventListener('click', () => mostrarVista('lista'));
  document.getElementById('btn-guardar').addEventListener('click', guardar);
  document.getElementById('btn-nueva-limpiar').addEventListener('click', limpiarFicha);
  const cerrarDiente = () => document.getElementById('diente-modal').classList.add('hidden');
  document.getElementById('modal-cerrar').addEventListener('click', cerrarDiente);
  document.getElementById('modal-x').addEventListener('click', cerrarDiente);
  // cerrar al hacer clic fuera de la caja (en el fondo oscuro)
  document.getElementById('diente-modal').addEventListener('click', e => {
    if (e.target.id === 'diente-modal') cerrarDiente();
  });
  // cerrar con la tecla Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarDiente();
  });
  document.getElementById('buscar').addEventListener('input', e => renderLista(e.target.value));

  // ── Odontograma en ventana emergente (pantallas pequeñas) ──
  // El mismo #odonto-host se mueve dentro del modal al abrir, y vuelve a
  // su lugar al cerrar, así render/clicks/COPD siguen funcionando igual.
  const odontoHost   = document.getElementById('odonto-host');
  const odontoHome   = odontoHost.parentNode;          // ubicación original (la hoja)
  const odontoHomeRef= odontoHost.nextSibling;         // para devolverlo al mismo punto
  const odontoModal  = document.getElementById('odonto-modal');
  const odontoBody   = document.getElementById('odonto-modal-body');

  function abrirOdonto() {
    odontoBody.appendChild(odontoHost);
    odontoModal.classList.remove('hidden');
  }
  function cerrarOdonto() {
    odontoModal.classList.add('hidden');
    odontoHome.insertBefore(odontoHost, odontoHomeRef);  // devolver a su sitio
  }
  document.getElementById('btn-abrir-odonto').addEventListener('click', abrirOdonto);
  document.getElementById('odonto-cerrar').addEventListener('click', cerrarOdonto);
  document.getElementById('odonto-x').addEventListener('click', cerrarOdonto);
  odontoModal.addEventListener('click', e => { if (e.target.id === 'odonto-modal') cerrarOdonto(); });

  // Config nube
  document.getElementById('btn-config').addEventListener('click', () => {
    document.getElementById('cfg-url').value = getSheetsUrl();
    document.getElementById('config-modal').classList.remove('hidden');
  });
  document.getElementById('cfg-cerrar').addEventListener('click', () =>
    document.getElementById('config-modal').classList.add('hidden'));
  document.getElementById('cfg-guardar').addEventListener('click', () => {
    localStorage.setItem('FICHA_SHEETS_URL', document.getElementById('cfg-url').value.trim());
    document.getElementById('config-modal').classList.add('hidden');
    setEstado('⚙ Configuración guardada.');
  });

  // recalcular COPD si cambian inputs relevantes (no es necesario, pero barato)
  mostrarVista('ficha');
}

document.addEventListener('DOMContentLoaded', init);
