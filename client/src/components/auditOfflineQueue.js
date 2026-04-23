// =====================================================
// Cola offline para cambios de estado (IndexedDB)
// =====================================================

const DB_NAME = 'aud-queue-db';
const DB_VERSION = 1;
const STORE = 'pending';

const listeners = new Set();

function uuidv4() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'client_change_id' });
        store.createIndex('by_token', 'token', { unique: false });
        store.createIndex('by_created', 'created_at', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function notify() {
  count().then(n => listeners.forEach(cb => { try { cb(n); } catch {} }));
}

export function subscribe(cb) {
  listeners.add(cb);
  count().then(cb).catch(() => cb(0));
  return () => listeners.delete(cb);
}

export async function enqueue({ token, item_id, estado, observaciones, metadata }) {
  const db = await openDB();
  const entry = {
    client_change_id: uuidv4(),
    token,
    item_id,
    estado,
    observaciones: observaciones || null,
    metadata: metadata || null,
    created_at: Date.now(),
    attempts: 0,
    last_error: null,
  };
  await new Promise((res, rej) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(entry);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
  notify();
  return entry;
}

export async function remove(client_change_id) {
  const db = await openDB();
  await new Promise((res, rej) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).delete(client_change_id);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
  notify();
}

export async function bumpAttempt(client_change_id, errorMsg) {
  const db = await openDB();
  await new Promise((res, rej) => {
    const t = db.transaction(STORE, 'readwrite');
    const s = t.objectStore(STORE);
    const g = s.get(client_change_id);
    g.onsuccess = () => {
      const v = g.result;
      if (v) {
        v.attempts = (v.attempts || 0) + 1;
        v.last_error = errorMsg || null;
        s.put(v);
      }
    };
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
  notify();
}

export async function listByToken(token) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const idx = t.objectStore(STORE).index('by_token');
    const req = idx.getAll(token);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function count() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Sincroniza la cola para un token. fetcher recibe (entry) y retorna { ok, status, body }.
export async function sync(token, fetcher) {
  const pending = await listByToken(token);
  if (!pending.length) return { sent: 0, failed: 0, conflicts: [] };

  pending.sort((a, b) => a.created_at - b.created_at);
  let sent = 0, failed = 0;
  const conflicts = [];

  for (const entry of pending) {
    if ((entry.attempts || 0) >= 5) { failed++; continue; }
    try {
      const r = await fetcher(entry);
      if (r.ok) {
        await remove(entry.client_change_id);
        sent++;
      } else if (r.status === 404 || r.status === 400) {
        await remove(entry.client_change_id);
        conflicts.push({ entry, reason: r.body?.message || `HTTP ${r.status}` });
      } else if (r.status === 401) {
        return { sent, failed, conflicts, needsLogin: true };
      } else {
        await bumpAttempt(entry.client_change_id, r.body?.message || `HTTP ${r.status}`);
        failed++;
      }
    } catch (err) {
      await bumpAttempt(entry.client_change_id, err.message);
      failed++;
      if (err.name === 'TypeError') break;
    }
  }

  return { sent, failed, conflicts };
}

export { uuidv4 };
