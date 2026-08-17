const crypto = require('crypto');

function operationFingerprint(op) {
  return crypto.createHash('sha256').update(JSON.stringify({
    id: op.id, deviceId: op.deviceId, store: op.store, type: op.type,
    key: op.key, before: op.before ?? null, after: op.after ?? null, createdAt: op.createdAt,
  })).digest('hex');
}

function validateOperations(operations) {
  const ids = new Set();
  const fingerprints = new Set();
  for (const op of operations || []) {
    if (!op || !op.id || !op.deviceId || !op.store || !op.type || op.key == null) throw new Error('Некорректная операция синхронизации');
    if (ids.has(op.id)) throw new Error(`Дублирующая операция: ${op.id}`);
    ids.add(op.id);
    const fingerprint = operationFingerprint(op);
    if (fingerprints.has(fingerprint)) throw new Error(`Повтор операции: ${op.id}`);
    fingerprints.add(fingerprint);
  }
  return true;
}

module.exports = { operationFingerprint, validateOperations };
