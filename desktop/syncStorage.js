const fs = require('fs');
const path = require('path');

function createSyncStorage(dataDir) {
  const file = path.join(dataDir, 'sync-journal.json');
  function read() {
    if (!fs.existsSync(file)) return [];
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) || []; } catch { return []; }
  }
  function append(operation) {
    const rows = read();
    rows.push(operation);
    fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
  }
  function replace(rows) { fs.writeFileSync(file, JSON.stringify(rows || [], null, 2), 'utf8'); }
  return { read, append, replace, file };
}

module.exports = { createSyncStorage };
