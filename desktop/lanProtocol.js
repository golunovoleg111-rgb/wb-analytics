const { URL } = require('url');

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function createProtocol({ stores, readStore, writeStore, clearStore }) {
  return async function handle(req) {
    const url = new URL(req.url || '/', 'http://bjob.lan');
    if (req.method === 'GET' && url.pathname === '/lan/hello') {
      return { ok: true, protocol: 1, stores };
    }
    if (req.method === 'GET' && url.pathname === '/lan/store') {
      const name = url.searchParams.get('name');
      if (!stores.includes(name)) throw new Error('unknown_store');
      return { ok: true, name, rows: await readStore(name) };
    }
    if (req.method === 'POST' && url.pathname === '/lan/store') {
      const payload = await readJson(req);
      if (!stores.includes(payload.name)) throw new Error('unknown_store');
      await writeStore(payload.name, payload.rows || []);
      return { ok: true, name: payload.name, count: (payload.rows || []).length };
    }
    if (req.method === 'POST' && url.pathname === '/lan/clear') {
      const payload = await readJson(req);
      if (!stores.includes(payload.name)) throw new Error('unknown_store');
      await clearStore(payload.name);
      return { ok: true, name: payload.name };
    }
    throw new Error('not_found');
  };
}

module.exports = { createProtocol };
