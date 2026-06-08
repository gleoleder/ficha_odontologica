// ═══════════════════════════════════════════════════════════════
//  Ficha Odontológica — Google Apps Script (backend en la nube)
//  Pega este código en: Google Sheets → Extensiones → Apps Script
//  Luego: Implementar → Nueva implementación → Aplicación web
//    · Ejecutar como: Yo (mi cuenta)
//    · Quién tiene acceso: Cualquier persona
//  Copia la URL /exec y pégala en la app (botón ⚙) o en config.js
// ═══════════════════════════════════════════════════════════════

// Columnas de la hoja "Fichas". El orden DEBE coincidir con fila().
var CAMPOS = [
  'id','created_at','ap_paterno','ap_materno','nombre','ap_esposo',
  'edad','domicilio','telefono',
  'alergias','hepatitis','diabetes','enf_renal','hipertension','enf_gastricas',
  'embarazo','trastornos_psico','ca','vih','tuberculosis','hemorragias',
  'cardiopatias','otros_pat','observaciones_pat',
  'motivo_consulta','enfermedad_actual',
  'higiene','protesis_fija','protesis_removible','trat_previo','trat_previo_obs','atm',
  'copd','copd_rango','odonto_texto',
  'cepillo_veces','cepillo_comida','cepillo_ocasional','cepillo_nunca',
  'fluor_1','fluor_2','fluor_3',
  'p_tartaro','p_calculo','p_bolsas','p_movilidad','p_grado'
];

function doPost(e) {
  try {
    var action = e.parameter.action;
    var data   = JSON.parse(e.parameter.data || '{}');
    var ss     = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'saveFicha') saveFicha(ss, data);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

function doGet(e) {
  return json({ ok: true, msg: 'Ficha Odontológica API activa' });
}

// ── Guardar / actualizar una ficha ─────────────────────────────
//  Si ya existe una fila con el mismo id, la reemplaza (upsert).
function saveFicha(ss, ficha) {
  var sh = ss.getSheetByName('Fichas');
  if (!sh) {
    sh = ss.insertSheet('Fichas');
    sh.appendRow(CAMPOS);
    sh.getRange(1, 1, 1, CAMPOS.length)
      .setFontWeight('bold').setBackground('#0f2740').setFontColor('#d99a2b');
    sh.setFrozenRows(1);
  }

  var nueva = fila(ficha);

  // Buscar si el id ya existe para actualizar en su lugar
  var ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(ficha.id) && ficha.id) {
      sh.getRange(i + 2, 1, 1, nueva.length).setValues([nueva]);
      return;
    }
  }
  sh.appendRow(nueva);
}

// Convierte el objeto ficha en un arreglo en el orden de CAMPOS
function fila(f) {
  return CAMPOS.map(function (k) {
    var v = f[k];
    if (v === true)  return 'SÍ';
    if (v === false) return '';
    if (v === undefined || v === null) return '';
    return v;
  });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
