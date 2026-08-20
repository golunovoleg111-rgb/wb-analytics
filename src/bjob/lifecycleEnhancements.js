import * as DB from './db.js';
import { session } from './userAuth.js';
import { printQrLabel } from './fbsQrPrint.js';

const FBS_KEY = 'bjob:fbs:v2';
let installed = false;
let observer = null;
let syncTimer = null;
let transferBusy = false;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uid = prefix => `${prefix}-${crypto.randomUUID()}`;
const currentShop = () => localStorage.getItem('bjob:v2:active-shop') || null;
const isAdmin = () => {
  const u = session();
  return u?.role === 'admin' || u?.permissions?.all === true;
};

function toast(text, error = false) {
  let node = document.querySelector('#bjob-toast');
  if (!node) {
    node = document.createElement('div');
    node.id = 'bjob-toast';
    document.body.appendChild(node);
  }
  node.textContent = text;
  node.dataset.type = error ? 'error' : 'ok';
  clearTimeout(window.__bjobLifecycleToast);
  window.__bjobLifecycleToast = setTimeout(() => node.remove(), 2800);
}

function audit(type, details = {}) {
  return DB.put('audit', {
    id: uid('audit'),
    type,
    userId: session()?.id || null,
    login: session()?.login || null,
    date: new Date().toISOString(),
    details
  }).catch(() => {});
}

function confirmDelete(label, extra = '') {
  return window.confirm(`Удалить ${label}?${extra ? `\n\n${extra}` : ''}`);
}

async function deleteUser(id) {
  if (!isAdmin()) return toast('Требуются права администратора.', true);
  const u = await DB.get('users', id);
  if (!u) return;
  if (u.id === session()?.id) return toast('Нельзя удалить текущего пользователя.', true);
  if (!confirmDelete(`сотрудника «${u.name || u.login}»`, 'Действие необратимо.')) return;
  await DB.remove('users', id);
  await audit('user.delete', { userId: id, login: u.login });
  toast('Сотрудник удалён');
  location.reload();
}

async function deleteShop(id) {
  if (!isAdmin()) return toast('Требуются права администратора.', true);
  const shop = await DB.get('shops', id);
  if (!shop) return;
  if (!confirmDelete(`магазин «${shop.name}»`, 'Данные магазина в операционных таблицах сохраняются и не удаляются автоматически.')) return;
  await DB.remove('shops', id);
  if (currentShop() === id) localStorage.removeItem('bjob:v2:active-shop');
  await audit('shop.delete', { shopId: id, name: shop.name });
  toast('Магазин удалён');
  location.reload();
}

async function deleteGenericWarehouse(id) {
  if (!isAdmin()) return toast('Требуются права администратора.', true);
  const warehouse = await DB.get('warehouses', id);
  if (!warehouse) return;
  const boxes = (await DB.all('boxes')).filter(b => b.warehouseId === id);
  if (boxes.length) return toast(`Нельзя удалить склад: на нём ${boxes.length} коробов. Сначала удалите или переместите короба.`, true);
  if (!confirmDelete(`склад «${warehouse.name}»`, 'Пустой склад будет удалён.')) return;
  await DB.remove('warehouses', id);
  await audit('warehouse.delete', { warehouseId: id, type: warehouse.type });
  toast('Склад удалён');
  location.reload();
}

function injectButton(parent, label, action, className = 'ui-btn ghost') {
  if (parent.querySelector(`[data-lifecycle-action="${action}"]`)) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.dataset.lifecycleAction = action;
  b.textContent = label;
  parent.appendChild(b);
}

async function decorateManagement() {
  if (!isAdmin()) return;
  const route = localStorage.getItem('bjob:route');
  if (route === 'shops') {
    const rows = await DB.all('shops');
    document.querySelectorAll('#view .list > article').forEach((card, index) => {
      const row = rows[index];
      if (!row) return;
      injectButton(card, 'Удалить', `delete-shop:${row.id}`);
    });
  }
  if (route === 'employees' || route === 'users') {
    const rows = await DB.all('users');
    document.querySelectorAll('#view .list > article').forEach((card, index) => {
      const row = rows[index];
      if (!row || row.id === session()?.id) return;
      injectButton(card, 'Удалить', `delete-user:${row.id}`);
    });
  }
}

async function decorateGenericWarehouses() {
  const route = localStorage.getItem('bjob:route');
  if (route !== 'fbo' || !isAdmin()) return;
  const rows = (await DB.all('warehouses')).filter(w => String(w.type).toUpperCase() === 'FBO');
  document.querySelectorAll('#view .warehouse-card').forEach((card, index) => {
    const row = rows[index];
    if (!row) return;
    injectButton(card, 'Удалить склад', `delete-warehouse:${row.id}`);
  });
}

function loadFbsState() {
  try { return JSON.parse(localStorage.getItem(FBS_KEY) || 'null'); } catch { return null; }
}

async function syncFbsDesignerToDb() {
  const w = loadFbsState();
  if (!w || !Array.isArray(w.boxes)) return;
  const shopId = currentShop();
  const existing = await DB.all('boxes');
  const managed = existing.filter(b => b.source === 'fbs-designer' && b.warehouseId === w.id);
  const liveIds = new Set();
  for (const box of w.boxes) {
    const zone = (w.zones || []).find(z => z.id === box.zoneId);
    const id = `fbsbox-${box.id}`;
    liveIds.add(id);
    await DB.put('boxes', {
      id,
      source: 'fbs-designer',
      shopId,
      warehouseId: w.id,
      zoneId: box.zoneId || null,
      address: zone?.name || 'Без зоны',
      code: box.code,
      qrPayload: `BJOB-FBS|${box.id}|${box.code}`,
      boxType: box.type === 'mix' ? 'mix' : 'mono',
      locked: Boolean(box.locked),
      contents: (box.contents || []).map(x => ({ ...x, quantity: Number(x.qty || x.quantity || 0), qty: Number(x.qty || x.quantity || 0) })),
      createdAt: box.createdAt || w.updatedAt || new Date().toISOString(),
      updatedAt: w.updatedAt || new Date().toISOString()
    });
  }
  for (const stale of managed) {
    if (!liveIds.has(stale.id)) await DB.remove('boxes', stale.id);
  }
}

function addFbsDeleteButton() {
  const w = loadFbsState();
  if (!w || !isAdmin()) return;
  const head = document.querySelector('.fbs-head .fbs-tools');
  if (!head) return;
  if (!head.querySelector('[data-lifecycle-action="delete-fbs-warehouse"]')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.lifecycleAction = 'delete-fbs-warehouse';
    b.textContent = 'Удалить склад';
    head.appendChild(b);
  }
}

function addBoxPrintButtons() {
  document.querySelectorAll('.fbs-box[data-box]').forEach(node => {
    if (node.querySelector('[data-lifecycle-print-qr]')) return;
    const code = node.querySelector('b')?.textContent?.trim();
    if (!code) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fbs-box-print';
    b.dataset.lifecyclePrintQr = node.dataset.box;
    b.textContent = 'QR';
    b.title = 'Печать наклейки 58 × 60 мм';
    node.appendChild(b);
  });
}

function decorateTransfersAndAssembly() {
  const route = localStorage.getItem('bjob:route');
  if (route === 'transfers') {
    const h1 = document.querySelector('#view .page-head h1');
    const p = document.querySelector('#view .page-head p');
    if (h1) h1.textContent = 'Перемещения между складами';
    if (p) p.textContent = 'Перемещение товара между FBO, FBS и другими складами.';
    const assembly = document.querySelector('#view [data-open-assembly]');
    if (assembly) assembly.textContent = 'Заявки на сборку FBS';
  }
  if (document.querySelector('.assembly-page')) {
    const p = document.querySelector('.assembly-page .page-head p');
    if (p) p.textContent = 'Заказы → заявка на сборку → маршрут по складу → комплектация.';
  }
}

async function openTransferDialog() {
  if (transferBusy) return;
  transferBusy = true;
  try {
    const warehouses = await DB.all('warehouses');
    if (warehouses.length < 2) return toast('Создайте минимум два склада, чтобы оформить перемещение.', true);
    const options = warehouses.map(w => `<option value="${esc(w.id)}">${esc(w.name)} · ${esc(String(w.type || '').toUpperCase())}</option>`).join('');
    const d = document.createElement('dialog');
    d.className = 'lifecycle-dialog';
    d.innerHTML = `<form method="dialog"><h2>Перемещение между складами</h2><label>Склад-отправитель<select name="fromWarehouse">${options}</select></label><label>Склад назначения<select name="toWarehouse">${options}</select></label><label>Артикул / SKU<input name="sku" required></label><label>Количество<input name="quantity" type="number" min="1" step="1" value="1" required></label><p class="lifecycle-error" aria-live="polite"></p><footer><button value="cancel">Отмена</button><button value="ok" class="primary">Создать перемещение</button></footer></form>`;
    document.body.appendChild(d);
    d.showModal();
    d.addEventListener('close', async () => {
      if (d.returnValue === 'ok') {
        try {
          const form = d.querySelector('form');
          const from = warehouses.find(w => w.id === form.fromWarehouse.value);
          const to = warehouses.find(w => w.id === form.toWarehouse.value);
          const sku = String(form.sku.value || '').trim();
          const quantity = Math.max(1, Number(form.quantity.value) || 1);
          if (!from || !to || from.id === to.id) throw new Error('Выберите разные склады.');
          if (!sku) throw new Error('Укажите артикул / SKU.');
          const kind = String(from.type).toUpperCase() === 'FBO' && String(to.type).toUpperCase() === 'FBS' ? 'FBO_TO_FBS' : 'WAREHOUSE_TRANSFER';
          const row = { id: uid('move'), kind, fromWarehouse: from.name, toWarehouse: to.name, fromWarehouseId: from.id, toWarehouseId: to.id, sku, quantity, status: 'draft', date: new Date().toISOString(), shopId: currentShop() };
          await DB.put('warehouseMoves', row);
          await audit('warehouse.transfer', { moveId: row.id, fromWarehouseId: from.id, toWarehouseId: to.id, sku, quantity });
          toast('Перемещение создано');
          location.reload();
        } catch (err) {
          toast(err.message, true);
        }
      }
      d.remove();
      transferBusy = false;
    }, { once: true });
  } catch (err) {
    transferBusy = false;
    toast(err.message, true);
  }
}

async function commitAssemblyPick(button) {
  if (button.dataset.lifecycleCommitted === '1') {
    delete button.dataset.lifecycleCommitted;
    return true;
  }
  if (button.dataset.lifecyclePending === '1') return false;
  const boxId = button.dataset.boxId;
  const taskId = button.closest('.assembly-page')?.querySelector('[data-finish-assembly]')?.dataset.finishAssembly;
  if (!boxId || !taskId) return true;
  const task = await DB.get('assemblyTasks', taskId);
  const box = await DB.get('boxes', boxId);
  if (!task || !box) return true;
  const lineId = button.dataset.takeLine;
  const line = (task.lines || []).find(x => x.id === lineId);
  if (!line) return true;
  if (Number(line.pickedQty || 0) >= Number(line.quantity || 0)) return false;
  const contents = Array.isArray(box.contents) ? box.contents : [];
  const wanted = String(line.article || line.sku || line.variantId || '');
  const item = contents.find(x => String(x.article || x.sku || x.variantId || '') === wanted && Number(x.qty ?? x.quantity ?? 0) > 0);
  if (!item) {
    toast(`В коробе ${box.code || boxId} больше нет изделия ${wanted}.`, true);
    return false;
  }
  const qty = Number(item.qty ?? item.quantity ?? 0);
  item.qty = qty - 1;
  item.quantity = qty - 1;
  button.dataset.lifecyclePending = '1';
  await DB.put('boxes', { ...box, contents, updatedAt: new Date().toISOString() });
  button.dataset.lifecycleCommitted = '1';
  setTimeout(() => button.click(), 0);
  return false;
}

async function onClickCapture(event) {
  const target = event.target?.closest?.('[data-lifecycle-action],[data-lifecycle-print-qr],[data-open-assembly],[data-action="add-transfer"],[data-take-line]');
  if (!target) return;
  const action = target.dataset.lifecycleAction || '';
  if (action.startsWith('delete-user:')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return deleteUser(action.slice('delete-user:'.length));
  }
  if (action.startsWith('delete-shop:')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return deleteShop(action.slice('delete-shop:'.length));
  }
  if (action.startsWith('delete-warehouse:')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return deleteGenericWarehouse(action.slice('delete-warehouse:'.length));
  }
  if (action === 'delete-fbs-warehouse') {
    event.preventDefault();
    event.stopImmediatePropagation();
    const w = loadFbsState();
    if (!w) return;
    if ((w.boxes || []).length) return toast(`Нельзя удалить склад: на нём ${(w.boxes || []).length} коробов. Сначала удалите или переместите короба.`, true);
    if (!confirmDelete(`склад «${w.name}»`, 'Пустой склад будет удалён.')) return;
    localStorage.removeItem(FBS_KEY);
    await audit('fbs.designer.warehouse.delete', { warehouseId: w.id, name: w.name });
    location.reload();
    return;
  }
  if (target.dataset.lifecyclePrintQr !== undefined) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const w = loadFbsState();
    const box = w?.boxes?.find(x => x.id === target.dataset.lifecyclePrintQr);
    if (box) printQrLabel(box);
    return;
  }
  if (target.matches('[data-action="add-transfer"]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return openTransferDialog();
  }
  if (target.matches('[data-take-line]')) {
    const handled = await commitAssemblyPick(target);
    if (!handled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}

async function decorate() {
  await decorateManagement();
  await decorateGenericWarehouses();
  addFbsDeleteButton();
  addBoxPrintButtons();
  decorateTransfersAndAssembly();
}

export function installLifecycleEnhancements() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', onClickCapture, true);
  observer = new MutationObserver(() => { decorate().catch(() => {}); });
  observer.observe(document.body, { childList: true, subtree: true });
  decorate().catch(() => {});
  clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    if (localStorage.getItem('bjob:route') === 'fbs') syncFbsDesignerToDb().catch(() => {});
  }, 1200);
}
