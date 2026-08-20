import * as DB from './db.js';

let installed = false;
let observer = null;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

async function renderTransfers() {
  if (localStorage.getItem('bjob:route') !== 'transfers') return;
  const table = document.querySelector('#view .data-table table');
  if (!table) return;
  const body = table.querySelector('tbody');
  if (!body) return;
  const rows = await DB.all('warehouseMoves');
  const html = rows.map(row => `<tr><td>${esc(row.date)}</td><td>${esc(row.fromWarehouse)}</td><td>${esc(row.toWarehouse)}</td><td>${esc(row.sku)}</td><td>${esc(row.quantity)}</td><td>${esc(row.status || 'draft')}</td></tr>`).join('');
  body.innerHTML = html || '<tr><td colspan="6">Нет данных</td></tr>';
}

export function installTransferViewEnhancement() {
  if (installed) return;
  installed = true;
  observer = new MutationObserver(() => { renderTransfers().catch(() => {}); });
  observer.observe(document.body, { childList: true, subtree: true });
  renderTransfers().catch(() => {});
}
