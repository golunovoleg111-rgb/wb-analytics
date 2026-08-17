const crypto = require('crypto');

function id() { return crypto.randomUUID(); }

function makeOperation({ deviceId, store, type, key, before, after }) {
  return {
    id: id(), deviceId, store, type, key,
    before: before ?? null, after: after ?? null,
    createdAt: new Date().toISOString(),
  };
}

function applyOperations(base, operations) {
  const state = new Map((base || []).map(row => [String(row.id ?? row.key ?? row.article ?? JSON.stringify(row)), row]));
  for (const op of operations || []) {
    const key = String(op.key);
    if (op.type === 'delete') state.delete(key);
    else if (op.after != null) state.set(key, op.after);
  }
  return [...state.values()];
}

function detectConflicts(localOps, remoteOps) {
  const localByKey = new Map((localOps || []).map(op => [`${op.store}:${op.key}`, op]));
  return (remoteOps || []).filter(op => localByKey.has(`${op.store}:${op.key}`) && localByKey.get(`${op.store}:${op.key}`).after !== op.after);
}

function createSyncEngine({ deviceId = id(), readJournal, appendJournal, getRemoteJournal, pushJournal }) {
  return {
    deviceId,
    async record(change) {
      const operation = makeOperation({ deviceId, ...change });
      await appendJournal(operation);
      return operation;
    },
    async prepareSync() {
      const local = await readJournal();
      const remote = await getRemoteJournal();
      return { local, remote, conflicts: detectConflicts(local, remote) };
    },
    async push() {
      const operations = await readJournal();
      return pushJournal(operations);
    },
    apply(base, operations) { return applyOperations(base, operations); },
  };
}

module.exports = { makeOperation, applyOperations, detectConflicts, createSyncEngine };
