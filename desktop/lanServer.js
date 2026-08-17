const http = require('http');
const os = require('os');
const crypto = require('crypto');

function localIPv4() {
  for (const values of Object.values(os.networkInterfaces())) {
    for (const item of values || []) {
      if (item.family === 'IPv4' && !item.internal) return item.address;
    }
  }
  return null;
}

function createLanServer({ port = 8787, token = crypto.randomBytes(18).toString('hex'), onRequest = async () => ({ ok: true }) } = {}) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-BJOB-LAN-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.headers['x-bjob-lan-token'] !== token) { res.writeHead(401); res.end(JSON.stringify({ error: 'unauthorized' })); return; }
    try {
      const result = await onRequest(req);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message || 'request_failed' }));
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => resolve({ server, port, token, address: localIPv4() }));
  });
}

module.exports = { createLanServer, localIPv4 };
