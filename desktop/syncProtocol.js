const { validateOperations } = require('./syncValidation');

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function createSyncProtocol({ readJournal, appendOperations }) {
  return async function handle(req) {
    const url = new URL(req.url || '/', 'http://bjob.lan');
    if (req.method === 'GET' && url.pathname === '/sync/journal') {
      return { ok: true, operations: await readJournal() };
    }
    if (req.method === 'POST' && url.pathname === '/sync/journal') {
      const payload = await readJson(req);
      const operations = Array.isArray(payload.operations) ? payload.operations : [];
      validateOperations(operations);
      await appendOperations(operations);
      return { ok: true, accepted: operations.length };
    }
    throw new Error('not_found');
  };
}

module.exports = { createSyncProtocol };
