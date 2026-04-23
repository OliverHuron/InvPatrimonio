// =====================================================
// SSE SERVICE — Server-Sent Events para actualizaciones en tiempo real
// Los clientes se subscriben a GET /api/patrimonioci/stream
// =====================================================

/** @type {Set<import('http').ServerResponse>} */
const clients = new Set();

/**
 * Registrar un cliente SSE
 * @param {import('http').ServerResponse} res
 */
function addClient(res) {
  clients.add(res);
}

/**
 * Eliminar un cliente SSE (cuando cierra la conexión)
 * @param {import('http').ServerResponse} res
 */
function removeClient(res) {
  clients.delete(res);
}

/**
 * Enviar un evento SSE a todos los clientes conectados
 * @param {string} event  — nombre del evento (ej. 'inventory_updated')
 * @param {object} data   — payload JSON
 */
function broadcast(event, data) {
  if (clients.size === 0) return 0;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let sent = 0;
  for (const res of clients) {
    try {
      res.write(payload);
      // Forzar flush si el socket lo soporta (evita buffering en algunos entornos)
      if (typeof res.flush === 'function') res.flush();
      sent++;
    } catch (_) {
      clients.delete(res);
    }
  }
  return sent;
}

/**
 * Número de clientes SSE actualmente conectados
 */
function clientCount() {
  return clients.size;
}

module.exports = { addClient, removeClient, broadcast, clientCount };
