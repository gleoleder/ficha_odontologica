// ═══════════════════════════════════════════════════════════════
//  DB — IndexedDB wrapper para Ficha Odontológica
//  Store: fichas
//
//  Cada ficha es el registro clínico legal completo de un paciente:
//  antecedentes, examen bucodental, odontograma (estado por diente),
//  índice COPD de la OMS, periodoncia, uso de cepillo y flúor.
// ═══════════════════════════════════════════════════════════════

const DB_NAME    = 'ficha_odontologica';
const DB_VERSION = 1;
let   _db        = null;

const DB = {
  open() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = e => {
        const db = e.target.result;

        // ── fichas ────────────────────────────────────────────
        if (!db.objectStoreNames.contains('fichas')) {
          const fs = db.createObjectStore('fichas', { keyPath: 'id', autoIncrement: true });
          fs.createIndex('ap_paterno', 'ap_paterno', { unique: false });
          fs.createIndex('nombre',     'nombre',     { unique: false });
          fs.createIndex('created_at', 'created_at', { unique: false });
        }
      };

      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  },

  // ── Helpers genéricos ───────────────────────────────────────

  _tx(store, mode = 'readonly') {
    return _db.transaction([store], mode).objectStore(store);
  },

  _all(store) {
    return new Promise((resolve, reject) => {
      const req = this._tx(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = e => reject(e.target.error);
    });
  },

  _get(store, id) {
    return new Promise((resolve, reject) => {
      const req = this._tx(store).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = e => reject(e.target.error);
    });
  },

  _put(store, obj) {
    return new Promise((resolve, reject) => {
      const req = this._tx(store, 'readwrite').put(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = e => reject(e.target.error);
    });
  },

  _add(store, obj) {
    return new Promise((resolve, reject) => {
      const req = this._tx(store, 'readwrite').add(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = e => reject(e.target.error);
    });
  },

  _delete(store, id) {
    return new Promise((resolve, reject) => {
      const req = this._tx(store, 'readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  },

  // ── Fichas ──────────────────────────────────────────────────

  getFichas()      { return this._all('fichas'); },
  getFicha(id)     { return this._get('fichas', id); },
  deleteFicha(id)  { return this._delete('fichas', id); },

  async saveFicha(ficha) {
    const now = new Date().toISOString();
    if (!ficha.created_at) ficha.created_at = now;
    ficha.updated_at = now;
    if (ficha.id) {
      await this._put('fichas', ficha);
      return ficha.id;
    }
    return this._add('fichas', ficha);
  },

  async searchFichas(query) {
    const q = (query || '').toLowerCase().trim();
    const all = (await this.getFichas())
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    if (!q) return all;
    return all.filter(f => {
      const full = `${f.ap_paterno || ''} ${f.ap_materno || ''} ${f.nombre || ''}`.toLowerCase();
      return full.includes(q);
    });
  }
};
