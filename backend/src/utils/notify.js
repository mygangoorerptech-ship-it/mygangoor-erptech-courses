// backend/src/utils/notify.js
// Simple SSE hub keyed by userId. Not intended for horizontal scaling without a shared pub/sub.
const clients = new Map(); // userId -> Set<res>
const DBG = process.env.DEBUG_NOTIFICATIONS !== '0';
const log = (...args) => { if (DBG) console.log('[notify]', ...args); };

export function addClient(userId, res) {
  const key = String(userId);
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key).add(res);
  log('SSE connect', { userId: key, clientCount: clients.get(key).size });

  res.on('close', () => {
    const set = clients.get(key);
    if (set) {
      set.delete(res);
      log('SSE disconnect', { userId: key, remaining: set.size });
      if (set.size === 0) clients.delete(key);
    }
  });
}

export function emitToUser(userId, event, payload) {
  const key = String(userId);
  const set = clients.get(key);
  if (!set || set.size === 0) { log('emit: no listeners', { userId: key, event }); return; }
  log('emit', { userId: key, event, listeners: set.size, payload: !!payload });
  const data = JSON.stringify(payload || {});
  for (const res of set) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${data}\n\n`);
  }
}
