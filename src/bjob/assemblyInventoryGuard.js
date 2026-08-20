import * as DB from './db.js';

let installed = false;
const toast = (text) => {
  let node = document.querySelector('#bjob-toast');
  if (!node) { node = document.createElement('div'); node.id = 'bjob-toast'; document.body.appendChild(node); }
  node.textContent = text;
  node.dataset.type = 'error';
  clearTimeout(window.__bjobGuardToast);
  window.__bjobGuardToast = setTimeout(() => node.remove(), 2800);
};

async function reserveOne(button) {
  const taskId = button.closest('.assembly-page')?.querySelector('[data-finish-assembly]')?.dataset.finishAssembly;
  const boxId = button.dataset.boxId;
  const lineId = button.dataset.takeLine;
  if (!taskId || !boxId || !lineId) return false;
  const [task, box] = await Promise.all([DB.get('assemblyTasks', taskId), DB.get('boxes', boxId)]);
  if (!task || !box) { toast('Не удалось определить задание или короб.'); return false; }
  const line = (task.lines || []).find(x => x.id === lineId);
  if (!line || Number(line.pickedQty || 0) >= Number(line.quantity || 0)) return false;
  const wanted = String(line.article || line.sku || line.variantId || '');
  const contents = Array.isArray(box.contents) ? box.contents.map(x => ({ ...x })) : [];
  const item = contents.find(x => String(x.article || x.sku || x.variantId || '') === wanted && Number(x.qty ?? x.quantity ?? 0) > 0);
  if (!item) { toast(`В коробе ${box.code || boxId} нет доступного количества ${wanted}.`); return false; }
  const next = Number(item.qty ?? item.quantity ?? 0) - 1;
  item.qty = next;
  item.quantity = next;
  await DB.put('boxes', { ...box, contents, updatedAt: new Date().toISOString() });
  return true;
}

function install() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-take-line]');
    if (!button) return;
    if (button.dataset.guardCommitted === '1') {
      delete button.dataset.guardCommitted;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.dataset.guardPending === '1') return;
    button.dataset.guardPending = '1';
    reserveOne(button).then(ok => {
      delete button.dataset.guardPending;
      if (!ok) return;
      button.dataset.lifecycleCommitted = '1';
      button.dataset.guardCommitted = '1';
      setTimeout(() => button.click(), 0);
    }).catch(err => {
      delete button.dataset.guardPending;
      toast(err.message || 'Не удалось списать изделие из короба.');
    });
  }, true);
}

export function installAssemblyInventoryGuard() { install(); }
