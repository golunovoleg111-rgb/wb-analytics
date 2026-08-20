import * as DB from './db.js';

let installed = false;
const KEY = 'bjob:fbs:v2';

async function mirror(button) {
  if (button.dataset.guardCommitted !== '1') return;
  const dbBox = await DB.get('boxes', button.dataset.boxId);
  if (!dbBox || !dbBox.source?.includes('fbs-designer')) return;
  const localId = String(dbBox.id).replace(/^fbsbox-/, '');
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { state = null; }
  const box = state?.boxes?.find(x => x.id === localId);
  if (!box) return;
  box.contents = (dbBox.contents || []).map(x => ({ ...x, qty: Number(x.qty ?? x.quantity ?? 0) }));
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function installFbsLocalMirror() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-take-line]');
    if (button?.dataset.guardCommitted === '1') mirror(button).catch(() => {});
  }, true);
}
