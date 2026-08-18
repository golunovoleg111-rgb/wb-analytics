import { session, can, listShops, activeShop, setActiveShop } from './userAuth.js';

const GROUPS = [
  ['БИЗНЕС', ['overview', 'analytics', 'reports', 'products', 'unit', 'advertising']],
  ['ЛОГИСТИКА', ['warehouses', 'shipments', 'fbs']],
  ['ОПЕРАЦИИ', ['production', 'imports', 'tables', 'documents']],
  ['ИНТЕГРАЦИИ', ['api', 'sync', 'lan', 'backup']],
  ['СИСТЕМА', ['settings', 'users', 'organization']]
];

const LABELS = {
  overview: 'Обзор', analytics: 'Аналитика', reports: 'Отчёты', products: 'Товары', unit: 'Юнит-экономика', advertising: 'Реклама',
  warehouses: 'Склады', shipments: 'Поставки', fbs: 'FBS', production: 'Производство', imports: 'Импорт данных', tables: 'Таблицы', documents: 'Документы',
  api: 'WB API', sync: 'Синхронизация', lan: 'LAN', backup: 'Резервные копии', settings: 'Настройки', users: 'Пользователи', organization: 'Организация'
};

const ROLE_LABEL = { admin: 'Администратор', leader: 'Руководитель', manager: 'Менеджер', warehouse: 'Склад', production: 'Производство' };
const STYLE_ID = 'bjob-navigation-v2-style';
const POPOVER_CLASS = 'bjob-nav-v2-popover';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function allowed(id) {
  const current = session();
  if (!current) return false;
  if (['users', 'organization', 'settings'].includes(id)) return current.role === 'admin' || can(id, 'view');
  return can(id, 'view');
}

function legacyRoute(id) {
  return ({ imports: 'import', tables: 'reports', documents: 'reports', api: 'api' }[id] || id);
}

function style() {
  if (document.getElementById(STYLE_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = `
    .bjob-nav-v2{position:sticky;top:72px;z-index:1000;background:rgba(255,255,255,.98);border-bottom:1px solid #e2e4e8;box-shadow:0 2px 12px #1111}
    .bjob-nav-v2-inner{max-width:1440px;margin:auto;padding:8px 34px;display:flex;gap:8px;align-items:center;overflow-x:auto;overflow-y:visible}
    .bjob-nav-v2-group{position:relative;flex:0 0 auto}.bjob-nav-v2-group>button{border:1px solid transparent;background:#fff;border-radius:9px;padding:9px 12px;color:#555b64;cursor:pointer;white-space:nowrap;font-weight:600}
    .bjob-nav-v2-group>button:hover,.bjob-nav-v2-group.open>button{background:#f4f5f7;color:#111}.bjob-nav-v2-tools{margin-left:auto;display:flex;gap:6px;align-items:center;flex:0 0 auto}
    .bjob-nav-v2-tools button{border:1px solid #e2e4e8;background:#fff;border-radius:9px;padding:8px 10px;cursor:pointer;white-space:nowrap}
    .bjob-nav-v2-popover{position:fixed;z-index:20000;min-width:220px;max-width:min(320px,calc(100vw - 20px));padding:6px;background:#fff;border:1px solid #e2e4e8;border-radius:12px;box-shadow:0 18px 45px #1113;display:grid;gap:2px}
    .bjob-nav-v2-popover button{border:0;background:#fff;text-align:left;padding:10px 11px;border-radius:8px;cursor:pointer;color:#333}.bjob-nav-v2-popover button:hover{background:#f0f1f3;font-weight:600}
    .bjob-user-status{font-size:11px;color:#747981;white-space:nowrap}.bjob-shop-chip{display:flex;align-items:center;gap:6px;border:1px solid #e2e4e8;background:#fff;border-radius:9px;padding:7px 9px;font-size:12px;white-space:nowrap}
    .bjob-shop-chip select{border:0;background:transparent;font:inherit;outline:0}.bjob-admin-hub{position:fixed;right:18px;top:84px;z-index:21000;background:#fff;border:1px solid #e2e4e8;border-radius:14px;box-shadow:0 18px 45px #1113;padding:8px;display:none;min-width:210px}.bjob-admin-hub.open{display:grid;gap:5px}
    .bjob-admin-hub button{border:0;background:#fff;text-align:left;padding:9px;border-radius:8px;cursor:pointer}.bjob-admin-hub button:hover{background:#f3f4f6}
    .bjob-admin-fixed{display:none!important}.bjob-system-page{padding:28px}.bjob-system-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.bjob-system-card{border:1px solid #e3e6eb;border-radius:14px;padding:18px;background:#fff}.bjob-system-card h2{margin-top:0}.bjob-system-card button{margin-top:10px}
  `;
  document.head.appendChild(styleEl);
}

function findLegacyButton(id) {
  const target = legacyRoute(id);
  return [...document.querySelectorAll('#mainNav [data-page], nav:not(.bjob-nav-v2) [data-page]')].find((button) => button.dataset.page === target);
}

function closePopover() {
  document.querySelectorAll(`.${POPOVER_CLASS}`).forEach((element) => element.remove());
  document.querySelectorAll('.bjob-nav-v2-group.open').forEach((element) => element.classList.remove('open'));
}

function openPopover(group, ids) {
  closePopover();
  group.classList.add('open');
  const popover = document.createElement('div');
  popover.className = POPOVER_CLASS;
  ids.forEach((id) => {
    const button = document.createElement('button');
    button.textContent = LABELS[id] || id;
    button.dataset.page = id;
    button.addEventListener('click', (event) => { event.stopPropagation(); closePopover(); navigate(id); });
    popover.appendChild(button);
  });
  document.body.appendChild(popover);
  const trigger = group.querySelector(':scope>button');
  const place = () => {
    const rect = trigger.getBoundingClientRect();
    const width = popover.offsetWidth;
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    const top = Math.min(rect.bottom + 5, Math.max(8, window.innerHeight - popover.offsetHeight - 8));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  };
  popover._place = place;
  place();
}

function adminClick(target) {
  const selector = `.bjob-admin-fixed [data-${target}]`;
  const button = document.querySelector(selector);
  if (button) { button.click(); return true; }
  return false;
}

async function renderSystemPage(id) {
  const app = document.querySelector('#app .bjob');
  const view = app?.querySelector('main#view');
  if (!view) return false;
  const content = {
    settings: `<div class="bjob-system-page"><div class="page-head"><div><small>СИСТЕМА</small><h1>Настройки</h1><p>Системные настройки B-JOB и локального рабочего пространства.</p></div></div><div class="bjob-system-grid"><section class="bjob-system-card"><h2>Рабочее пространство</h2><p>Название текущего магазина хранится локально.</p><button class="btn primary" data-system-settings>Открыть настройки профиля</button></section><section class="bjob-system-card"><h2>Автономный режим</h2><p>Данные приложения работают через локальную IndexedDB. Service Worker используется как дополнительный слой кеша.</p></section></div></div>`,
    sync: `<div class="bjob-system-page"><div class="page-head"><div><small>ИНТЕГРАЦИИ</small><h1>Синхронизация</h1><p>Управление локальной синхронизацией данных.</p></div></div><div class="bjob-system-grid"><section class="bjob-system-card"><h2>Локальная база</h2><p>Синхронизация с сервером не запускается автоматически без настроенного API.</p><button class="btn primary" data-page="api">Открыть WB API</button></section></div></div>`,
    lan: `<div class="bjob-system-page"><div class="page-head"><div><small>ИНТЕГРАЦИИ</small><h1>LAN</h1><p>Локальная сеть и обмен между рабочими местами.</p></div></div><div class="bjob-system-grid"><section class="bjob-system-card"><h2>LAN runtime</h2><p>Веб-версия работает локально в браузере. Desktop bridge подключается автоматически в нативной сборке.</p></section></div></div>`,
    backup: `<div class="bjob-system-page"><div class="page-head"><div><small>ИНТЕГРАЦИИ</small><h1>Резервные копии</h1><p>Экспорт и восстановление локальной базы B-JOB.</p></div></div><div class="bjob-system-grid"><section class="bjob-system-card"><h2>JSON backup</h2><p>Создайте полную резервную копию локальной базы.</p><button class="btn primary" data-admin="export">Экспорт JSON</button><button class="btn secondary" data-admin="import">Импорт JSON</button></section></div></div>`
  }[id];
  if (!content) return false;
  view.innerHTML = content;
  view.querySelector('[data-system-settings]')?.addEventListener('click', () => findLegacyButton('settings')?.click());
  view.querySelector('[data-page="api"]')?.addEventListener('click', () => findLegacyButton('api')?.click());
  view.querySelector('[data-admin="export"]')?.addEventListener('click', () => adminClick('export'));
  view.querySelector('[data-admin="import"]')?.addEventListener('click', () => adminClick('import'));
  return true;
}

async function navigate(id) {
  if (['users', 'organization'].includes(id)) {
    adminClick(id === 'users' ? 'users' : 'org');
    return;
  }
  if (id === 'backup') {
    if (!(await renderSystemPage('backup'))) adminClick('export');
    return;
  }
  if (['settings', 'sync', 'lan'].includes(id)) {
    await renderSystemPage(id);
    return;
  }
  const button = findLegacyButton(id);
  if (button) { button.click(); return; }
  if (typeof window.BJobNavigate === 'function') { await window.BJobNavigate(legacyRoute(id)); return; }
  window.dispatchEvent(new CustomEvent('bjob:navigate', { detail: { page: legacyRoute(id) } }));
}

async function shopChip() {
  const currentSession = session();
  if (!currentSession) return '';
  const shops = (await listShops()).filter((shop) => currentSession.role === 'admin' || currentSession.shopIds?.includes(shop.id));
  if (!shops.length) return '';
  const current = await activeShop();
  return `<div class="bjob-shop-chip">🏪 <select aria-label="Активный магазин">${shops.map((shop) => `<option value="${esc(shop.id)}" ${shop.id === current?.id ? 'selected' : ''}>${esc(shop.name)} · ${shop.marketplace === 'wb' ? 'WB' : 'Ozon'}</option>`).join('')}</select></div>`;
}

async function adminHub() {
  const currentSession = session();
  if (!currentSession || currentSession.role !== 'admin') return;
  let hub = document.querySelector('.bjob-admin-hub');
  if (!hub) {
    hub = document.createElement('div');
    hub.className = 'bjob-admin-hub';
    hub.innerHTML = '<button data-admin="shops">🏪 Магазины</button><button data-admin="users">👥 Сотрудники</button><button data-admin="org">⚙️ Организация и права</button>';
    document.body.appendChild(hub);
  }
  if (!hub.dataset.bound) {
    hub.dataset.bound = '1';
    hub.addEventListener('click', (event) => {
      const button = event.target.closest('[data-admin]');
      if (!button) return;
      adminClick(button.dataset.admin);
      hub.classList.remove('open');
    });
  }
}

async function render() {
  const currentSession = session();
  if (!currentSession) return;
  style();
  closePopover();
  document.querySelectorAll('.bjob-nav-v2').forEach((element) => element.remove());
  const nav = document.createElement('div');
  nav.className = 'bjob-nav-v2';
  const inner = document.createElement('div');
  inner.className = 'bjob-nav-v2-inner';
  for (const [title, ids] of GROUPS) {
    const visible = ids.filter(allowed);
    if (!visible.length) continue;
    const group = document.createElement('div');
    group.className = 'bjob-nav-v2-group';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = `${title} ▾`;
    trigger.addEventListener('click', (event) => { event.stopPropagation(); openPopover(group, visible); });
    group.appendChild(trigger);
    inner.appendChild(group);
  }
  const tools = document.createElement('div');
  tools.className = 'bjob-nav-v2-tools';
  const chip = document.createElement('div');
  chip.innerHTML = await shopChip();
  const select = chip.firstElementChild?.querySelector('select');
  if (select) {
    select.addEventListener('change', async (event) => {
      const selected = await setActiveShop(event.target.value);
      if (selected?.name) localStorage.setItem('bjob:shop', selected.name);
      location.reload();
    });
    tools.appendChild(chip.firstElementChild);
  }
  if (currentSession.role === 'admin') {
    const adminButton = document.createElement('button');
    adminButton.type = 'button';
    adminButton.textContent = '⚙ Админ';
    adminButton.addEventListener('click', (event) => { event.stopPropagation(); document.querySelector('.bjob-admin-hub')?.classList.toggle('open'); });
    tools.appendChild(adminButton);
  }
  const user = document.createElement('span');
  user.className = 'bjob-user-status';
  user.textContent = `${currentSession.name} · ${ROLE_LABEL[currentSession.role] || currentSession.role}`;
  tools.appendChild(user);
  inner.appendChild(tools);
  nav.appendChild(inner);

  const app = document.querySelector('#app .bjob');
  if (app) {
    const legacy = app.querySelector(':scope>nav#mainNav');
    if (legacy) legacy.style.display = 'none';
    const main = app.querySelector('main');
    app.insertBefore(nav, main || app.firstChild);
  } else {
    document.body.prepend(nav);
  }
  await adminHub();
}

let scheduled = false;
function ensure() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(async () => {
    scheduled = false;
    if (!session()) return;
    const legacy = document.querySelector('#app .bjob>nav#mainNav');
    const nav = document.querySelector('.bjob-nav-v2');
    if (!nav || legacy?.style.display !== 'none') await render();
  });
}

function observe() {
  ensure();
  new MutationObserver(() => ensure()).observe(document.body, { subtree: true, childList: true });
  window.addEventListener('resize', () => document.querySelectorAll(`.${POPOVER_CLASS}`).forEach((element) => element._place?.()));
  window.addEventListener('scroll', () => document.querySelectorAll(`.${POPOVER_CLASS}`).forEach((element) => element._place?.()), true);
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.bjob-nav-v2-group') && !event.target.closest(`.${POPOVER_CLASS}`) && !event.target.closest('.bjob-admin-hub')) closePopover();
  });
}

style();
observe();
