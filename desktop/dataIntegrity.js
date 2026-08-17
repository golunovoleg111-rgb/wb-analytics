const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function createBackupManifest(filePath, metadata = {}) {
  const stat = fs.statSync(filePath);
  return {
    format: 'bjob-backup-manifest',
    version: 1,
    file: path.basename(filePath),
    size: stat.size,
    sha256: sha256File(filePath),
    createdAt: new Date().toISOString(),
    ...metadata,
  };
}

function verifyBackup(filePath, manifest) {
  if (!manifest || manifest.format !== 'bjob-backup-manifest') throw new Error('Неверный manifest резервной копии');
  if (!fs.existsSync(filePath)) throw new Error('Файл резервной копии не найден');
  const stat = fs.statSync(filePath);
  const hash = sha256File(filePath);
  return { ok: stat.size === manifest.size && hash === manifest.sha256, size: stat.size, sha256: hash };
}

module.exports = { createBackupManifest, verifyBackup };
