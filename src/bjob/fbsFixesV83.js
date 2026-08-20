import { session } from './userAuth.js';
import { printQrLabel } from './fbsQrPrint.js';

const FBS_KEY = 'bjob:fbs:v2';
let installed = false;
let observer = null;
let decorating = false;
let catalogCache = null;

const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const isAdmin = () => { const u = session(); return u?.role === 'admin' || u?.permissions?.all === true; };
const load = () => { try { return JSON.parse(localStorage.getItem(FBS_KEY) || 'null'); } catch { return null; } };
const save = state => localStorage.setItem(FBS_KEY, JSON.stringify(state));
const uid = () => crypto.randomUUID();

function dialog(title, html, onSubmit) {
  const d = document.createElement('dialog');
  d.className = 'bjob-fbs-dialog';
  d.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2>${html}<footer><button value="cancel">Отмена</button><button value="ok" class="primary">Готово</button></footer></form>`;
  document.body.appendChild(d);
  d.addEventListener('close', () => {
    if (d.returnValue === 'ok') onSubmit(d);
    d.remove();
  }, { once: true });
  d.showModal();
  return d;
}

function injectZoneButton() {
  const tools = document.querySelector('.fbs-head .fbs-tools');
  if (!tools || tools.querySelector('[data-v83-add-zone]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.v83AddZone = '1';
  button.textContent = 'Добавить зону';
  tools.insertBefore(button, tools.querySelector('[data-finish]') || null);
}

function addZone() {
  const state = load();
  if (!state) return;
  const index = (state.zones || []).length + 1;
  const html = `<label>Название зоны<input name="name" value="Зона ${index}" required autofocus></label><label>Вместимость коробов<input name="capacity" type="number" min="0" step="1" value="0"><small>0 = без ограничения</small></label>`;
  dialog('Добавить зону', html, d => {
    const name = String(d.querySelector('[name=name]').value || '').trim();
    if (!name) return;
    const capacity = Math.max(0, Number(d.querySelector('[name=capacity]').value) || 0);
    const cols = Math.max(1, Math.ceil(Math.sqrt((state.zones || []).length + 1)));
    state.zones ||= [];
    state.zones.push({ id: uid(), name, capacity, x: 80 + ((state.zones.length % cols) * 260), y: 80 + (Math.floor(state.zones.length / cols) * 190), width: 230, height: 150, boxIds: [] });
    state.updatedAt = new Date().toISOString();
    save(state);
    location.reload();
  });
}

function adminDeleteZone(button) {
  const state = load();
  if (!state || !isAdmin()) return false;
  const zone = (state.zones || []).find(z => z.id === button.dataset.deleteZone);
  if (!zone) return true;
  const ids = Array.isArray(zone.boxIds) ? [...zone.boxIds] : [];
  const text = ids.length
    ? `В зоне есть ${ids.length} короб${ids.length === 1 ? '' : ids.length < 5 ? 'а' : 'ов'}. Короба не будут удалены — они останутся без зоны и их можно будет разместить заново.`
    : 'Зона пустая.';
  if (!window.confirm(`Удалить зону «${zone.name}»?\n\n${text}`)) return true;
  state.boxes ||= [];
  for (const id of ids) {
    const box = state.boxes.find(b => b.id === id);
    if (box) box.zoneId = null;
  }
  state.zones = (state.zones || []).filter(z => z.id !== zone.id);
  state.updatedAt = new Date().toISOString();
  save(state);
  location.reload();
  return true;
}

function collectFromValue(value, out, depth = 0) {
  if (depth > 4 || value == null) return;
  if (Array.isArray(value)) { for (const item of value.slice(0, 5000)) collectFromValue(item, out, depth + 1); return; }
  if (typeof value !== 'object') return;
  const article = value.article ?? value.sku ?? value.vendorCode ?? value.sellerArticle ?? value.supplierArticle ?? value.nmId;
  if (article != null && String(article).trim()) {
    out.push({ article: String(article).trim(), name: String(value.name ?? value.title ?? value.productName ?? '').trim(), color: String(value.color ?? '').trim(), size: String(value.size ?? '').trim() });
  }
  for (const [key, child] of Object.entries(value)) {
    if (/^(image|photo|images|photos|history|logs|audit|analytics)$/i.test(key)) continue;
    if (typeof child === 'object') collectFromValue(child, out, depth + 1);
  }
}

async function collectIndexedDb(out) {
  if (!window.indexedDB?.databases) return;
  let databases = [];
  try { databases = await indexedDB.databases(); } catch { return; }
  for (const meta of databases) {
    if (!meta?.name) continue;
    try {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(meta.name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      for (const storeName of Array.from(db.objectStoreNames)) {
        try {
          const rows = await new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          });
          collectFromValue(rows, out);
        } catch {}
      }
      db.close();
    } catch {}
  }
}

async function getCatalog() {
  if (catalogCache) return catalogCache;
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    try { collectFromValue(JSON.parse(localStorage.getItem(key)), out); } catch {}
  }
  await collectIndexedDb(out);
  const map = new Map();
  for (const item of out) {
    const key = item.article.toLowerCase();
    if (!map.has(key) || (!map.get(key).name && item.name)) map.set(key, item);
  }
  catalogCache = [...map.values()].sort((a, b) => a.article.localeCompare(b.article, 'ru', { numeric: true }));
  return catalogCache;
}

async function openContents(boxId) {
  const state = load();
  const box = state?.boxes?.find(x => x.id === boxId);
  if (!state || !box) return;
  const catalog = await getCatalog();
  const listId = `bjob-v83-products-${uid()}`;
  const options = catalog.slice(0, 2000).map(item => `<option value="${esc(item.article)}">${esc(item.article)}${item.name ? ` — ${esc(item.name)}` : ''}</option>`).join('');
  const html = `<label>Артикул / SKU<input name="article" list="${listId}" autocomplete="off" placeholder="Начните вводить артикул…" required><datalist id="${listId}">${options}</datalist></label><label>Наименование<input name="name" readonly></label><label>Цвет<input name="color"></label><label>Размер<input name="size"></label><label>Количество<input name="qty" type="number" min="1" step="1" value="1" required></label><p class="fbs-catalog-hint">Поиск идёт по началу артикула. В списке используются данные каталога, найденные в локальной базе приложения.</p>`;
  const d = dialog('Добавить изделие в короб', html, dialogNode => {
    const article = String(dialogNode.querySelector('[name=article]').value || '').trim();
    const item = catalog.find(x => x.article.toLowerCase() === article.toLowerCase());
    const name = String(dialogNode.querySelector('[name=name]').value || item?.name || '').trim();
    const color = String(dialogNode.querySelector('[name=color]').value || item?.color || '').trim();
    const size = String(dialogNode.querySelector('[name=size]').value || item?.size || '').trim();
    const qty = Number(dialogNode.querySelector('[name=qty]').value) || 0;
    if (!article || qty <= 0) return;
    box.contents ||= [];
    const existing = box.contents.find(x => String(x.article).toLowerCase() === article.toLowerCase() && String(x.color || '') === color && String(x.size || '') === size);
    if (existing) existing.qty = Number(existing.qty || 0) + qty;
    else box.contents.push({ article, name, color, size, qty });
    state.updatedAt = new Date().toISOString();
    save(state);
    location.reload();
  });
  const articleInput = d.querySelector('[name=article]');
  const nameInput = d.querySelector('[name=name]');
  const colorInput = d.querySelector('[name=color]');
  const sizeInput = d.querySelector('[name=size]');
  articleInput.addEventListener('input', () => {
    const value = articleInput.value.trim().toLowerCase();
    const exact = catalog.find(x => x.article.toLowerCase() === value);
    if (exact) {
      nameInput.value = exact.name || '';
      if (exact.color) colorInput.value = exact.color;
      if (exact.size) sizeInput.value = exact.size;
    } else nameInput.value = '';
  });
}

function addPrintButton() {
  document.querySelectorAll('.fbs-box[data-box]').forEach(node => {
    if (node.querySelector('[data-v83-print-qr]')) return;
    const boxId = node.dataset.box;
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.v83PrintQr = boxId;
    b.className = 'fbs-box-print';
    b.textContent = 'Печать QR';
    b.title = 'Печать наклейки 58 × 60 мм';
    node.appendChild(b);
  });
}

function addUnassignedTray() {
  const state = load();
  const canvas = document.querySelector('[data-canvas]');
  if (!state || !canvas) return;
  const boxes = (state.boxes || []).filter(b => !b.zoneId);
  let tray = canvas.querySelector('[data-v83-unassigned]');
  if (!boxes.length) { if (tray) tray.remove(); return; }
  const signature = boxes.map(b => `${b.id}:${(b.contents || []).reduce((n, x) => n + Number(x.qty || 0), 0)}`).join('|');
  if (tray?.dataset.signature === signature) return;
  if (!tray) {
    tray = document.createElement('section');
    tray.dataset.v83Unassigned = '1';
    tray.className = 'fbs-unassigned-tray';
    canvas.appendChild(tray);
  }
  tray.dataset.signature = signature;
  tray.innerHTML = `<b>Короба без зоны · ${boxes.length}</b><small>Администратор удалил зону. Короба сохранены и требуют нового размещения.</small>${boxes.map(b => `<div><strong>${esc(b.code)}</strong><span>${(b.contents || []).reduce((n, x) => n + Number(x.qty || 0), 0)} изделий</span></div>`).join('')}`;
}

function decorate() {
  if (decorating || localStorage.getItem('bjob:route') !== 'fbs') return;
  decorating = true;
  try {
    if (observer) observer.disconnect();
    injectZoneButton();
    addPrintButton();
    addUnassignedTray();
  } finally {
    if (observer) observer.observe(document.body, { childList: true, subtree: true });
    decorating = false;
  }
}

function onClickCapture(event) {
  const target = event.target?.closest?.('[data-v83-add-zone],[data-v83-print-qr],[data-delete-zone],[data-content]');
  if (!target) return;
  if (target.dataset.v83AddZone) { event.preventDefault(); event.stopImmediatePropagation(); addZone(); return; }
  if (target.dataset.v83PrintQr !== undefined) {
    event.preventDefault(); event.stopImmediatePropagation();
    const state = load(); const box = state?.boxes?.find(x => x.id === target.dataset.v83PrintQr);
    if (box) printQrLabel(box);
    return;
  }
  if (target.dataset.deleteZone !== undefined && isAdmin()) {
    event.preventDefault(); event.stopImmediatePropagation(); adminDeleteZone(target); return;
  }
  if (target.dataset.content !== undefined) {
    event.preventDefault(); event.stopImmediatePropagation(); openContents(target.dataset.content).catch(err => console.error(err)); return;
  }
}

export function installFbsFixesV83() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', onClickCapture, true);
  observer = new MutationObserver(() => decorate());
  observer.observe(document.body, { childList: true, subtree: true });
  decorate();
}
