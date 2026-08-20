import * as DB from './db.js';
import { session } from './userAuth.js';

let installed = false;
const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const isAdmin = () => { const u = session(); return u?.role === 'admin' || u?.permissions?.all === true; };
const toast = text => { let n = document.querySelector('#bjob-toast'); if (!n) { n = document.createElement('div'); n.id = 'bjob-toast'; document.body.appendChild(n); } n.textContent = text; n.dataset.type = 'error'; setTimeout(() => n.remove(), 2600); };
const uid = () => `audit-${crypto.randomUUID()}`;

async function removeEntity(store, id, label) {
  if (!isAdmin()) return toast('Требуются права администратора.');
  const row = await DB.get(store, id);
  if (!row) return;
  if (store === 'users' && row.id === session()?.id) return toast('Нельзя удалить текущего пользователя.');
  if (!confirm(`Удалить ${label} «${row.name || row.login || id}»?\n\nДействие необратимо.`)) return;
  await DB.remove(store, id);
  await DB.put('audit', { id: uid(), type: `${store === 'users' ? 'user' : 'shop'}.delete`, userId: session()?.id || null, date: new Date().toISOString(), details: { id } }).catch(() => {});
  location.reload();
}

function visibleCards() {
  const view = document.querySelector('#view');
  if (!view) return [];
  return [...view.querySelectorAll('article,li,tr,.card,.list-item,[class*="card"],[class*="row"]')].filter(el => !el.closest('dialog'));
}

async function decorate() {
  if (!isAdmin()) return;
  const view = document.querySelector('#view');
  if (!view) return;
  const heading = (view.querySelector('h1')?.textContent || '').trim().toLowerCase();
  const isShops = heading.includes('магазин');
  const isUsers = heading.includes('сотрудник') || heading.includes('пользовател');
  if (!isShops && !isUsers) return;
  const store = isShops ? 'shops' : 'users';
  const rows = await DB.all(store);
  const cards = visibleCards();
  for (const row of rows) {
    if (row.id === session()?.id) continue;
    const needle = String(row.name || row.login || '').trim().toLowerCase();
    if (!needle) continue;
    const card = cards.find(el => el.textContent.toLowerCase().includes(needle) && !el.querySelector(`[data-v83-delete-${store}]`));
    if (!card) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset[`v83Delete${store === 'shops' ? 'Shops' : 'Users'}`] = row.id;
    b.textContent = 'Удалить';
    b.className = 'ui-btn ghost';
    b.style.marginLeft = '8px';
    card.appendChild(b);
  }
}

function onClick(event) {
  const target = event.target?.closest?.('[data-v83-delete-shops],[data-v83-delete-users]');
  if (!target) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const id = target.dataset.v83DeleteShops || target.dataset.v83DeleteUsers;
  removeEntity(target.dataset.v83DeleteShops !== undefined ? 'shops' : 'users', id, target.dataset.v83DeleteShops !== undefined ? 'магазин' : 'сотрудника').catch(err => toast(err.message || 'Не удалось удалить.'));
}

export function installManagementFixV83() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', onClick, true);
  const observer = new MutationObserver(() => decorate().catch(() => {}));
  observer.observe(document.body, { childList: true, subtree: true });
  decorate().catch(() => {});
}
