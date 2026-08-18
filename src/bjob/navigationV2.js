import { session, can, listShops, activeShop, setActiveShop } from './userAuth.js';

const ROUTES = [
  { group: 'ГЛАВНОЕ', id: 'dashboard', label: 'Главная', legacy: 'dashboard' },
  { group: 'АНАЛИТИКА', id: 'reports', label: 'Отчёты', legacy: 'reports' },
  { group: 'АНАЛИТИКА', id: 'analytics', label: 'Аналитика', legacy: 'analytics' },
  { group: 'ТОВАРЫ', id: 'products', label: 'Товары', legacy: 'products' },
  { group: 'ТОВАРЫ', id: 'prices', label: 'Цены и скидки' },
  { group: 'ТОВАРЫ', id: 'tables', label: 'Таблицы' },
  { group: 'МАГАЗИНЫ', id: 'shops', label: 'Магазины' },
  { group: 'МАГАЗИНЫ', id: 'workspace', label: 'Рабочие пространства и личные кабинеты' },
  { group: 'ЛОГИСТИКА', id: 'fbo', label: 'Склад FBO', legacy: 'stock' },
  { group: 'ЛОГИСТИКА', id: 'fbs', label: 'Склад FBS', legacy: 'fbs' },
  { group: 'ЛОГИСТИКА', id: 'supplies', label: 'Поставки', legacy: 'shipments' },
  { group: 'ЛОГИСТИКА', id: 'supplies-fbs', label: 'Поставки FBS' },
  { group: 'ПРОИЗВОДСТВО', id: 'production', label: 'Производство', legacy: 'production' },
  { group: 'ПРОДАЖИ', id: 'sales-history', label: 'История продаж', legacy: 'sales' },
  { group: 'ИНТЕГРАЦИИ', id: 'api', label: 'Интеграция по API', legacy: 'api' },
  { group: 'ИНТЕГРАЦИИ', id: 'lan', label: 'Интеграция по LAN' },
  { group: 'ИНТЕГРАЦИИ', id: 'sync', label: 'Синхронизация' },
  { group: 'СИСТЕМА', id: 'personal', label: 'Личный кабинет', legacy: 'settings' },
  { group: 'СИСТЕМА', id: 'access', label: 'Персональный доступ' },
  { group: 'СИСТЕМА', id: 'history', label: 'История изменений' },
  { group: 'СИСТЕМА', id: 'settings', label: 'Настройки' },
  { group: 'СИСТЕМА', id: 'organization', label: 'Организация' },
  { group: 'СИСТЕМА', id: 'users', label: 'Сотрудники' },
  { group: 'СИСТЕМА', id: 'backup', label: 'Резервные копии' }
];

const GROUPS = [...new Set(ROUTES.map(route => route.group))];
const STYLE_ID = 'bjob-phase2-shell-style';
const NAV_ID = 'bjob-phase2-shell';
const ROLE_LABEL = { admin: 'Администратор', leader: 'Руководитель', manager: 'Менеджер', warehouse: 'Склад', production: 'Производство' };
let mounted = false;
let observer = null;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function allowed(route) {
  const current = session();
  if (!current) return false;
  if (current.role === 'admin') return true;
  if (['organization', 'users', 'settings', 'backup'].includes(route.id)) return can(route.id, 'view');
  return can(route.id, 'view');
}

function addStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .bjob-phase2-shell{position:sticky;top:0;z-index:30000;background:#fff;border-bottom:1px solid #e5e7eb;box-shadow:0 3px 16px #1112}
    .bjob-phase2-inner{max-width:1600px;margin:auto;display:flex;align-items:center;gap:8px;padding:8px 18px;box-sizing:border-box}
    .bjob-phase2-brand{font-weight:800;letter-spacing:.02em;padding:8px 10px;white-space:nowrap}
    .bjob-phase2-groups{display:flex;align-items:center;gap:4px;min-width:0;overflow:auto}
    .bjob-phase2-group{position:relative;flex:0 0 auto}
    .bjob-phase2-trigger,.bjob-phase2-tool{border:1px solid transparent;background:#fff;border-radius:9px;padding:9px 11px;cursor:pointer;font:600 13px system-ui;white-space:nowrap}
    .bjob-phase2-trigger:hover,.bjob-phase2-trigger.open,.bjob-phase2-tool:hover{background:#f3f4f6}
    .bjob-phase2-popover{position:fixed;z-index:31000;min-width:230px;max-width:340px;padding:6px;background:#fff;border:1px solid #e2e5e9;border-radius:12px;box-shadow:0 20px 55px #1114;display:grid;gap:2px}
    .bjob-phase2-popover button{border:0;background:#fff;text-align:left;padding:10px 12px;border-radius:8px;cursor:pointer;font:500 13px system-ui}
    .bjob-phase2-popover button:hover{background:#f2f3f5}
    .bjob-phase2-tools{margin-left:auto;display:flex;align-items:center;gap:6px;min-width:0}
    .bjob-phase2-shop{border:1px solid #e2e5e9;border-radius:9px;padding:7px 9px;background:#fff;max-width:230px}
    .bjob-phase2-shop select{border:0;background:transparent;max-width:190px;outline:0;font:500 12px system-ui}
    .bjob-phase2-user{font:11px system-ui;color:#6b7280;white-space:nowrap}
    .bjob-phase2-screen{padding:28px;box-sizing:border-box}
    .bjob-phase2-screen h1{margin:0 0 8px}.bjob-phase2-screen p{color:#6b7280}
    .bjob-phase2-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin-top:20px}
    .bjob-phase2-card{border:1px solid #e3e6eb;border-radius:14px;background:#fff;padding:18px}
    .bjob-phase2-card h2{margin-top:0}.bjob-phase2-card button{margin-top:10px}
    .bjob-phase2-note{padding:12px;border-radius:10px;background:#f6f7f8;color:#555;margin-top:14px}
    .bjob-phase2-legacy-hidden .sidebar,.bjob-phase2-legacy-hidden .topbar{display:none!important}
  `;
  document.head.appendChild(style);
}

function hideLegacyShell() {
  const shell = document.querySelector('.app-shell');
  if (!shell) return false;
  shell.classList.add('bjob-phase2-legacy-hidden');
  const sidebar = shell.querySelector('.sidebar');
  const topbar = shell.querySelector('.topbar');
  if (sidebar) sidebar.setAttribute('aria-hidden', 'true');
  if (topbar) topbar.setAttribute('aria-hidden', 'true');
  return true;
}

function legacyButton(route) {
  if (!route.legacy) return null;
  return document.querySelector(`.sidebar [data-page="${CSS.escape(route.legacy)}"]`);
}

function closePopover() {
  document.querySelectorAll('.bjob-phase2-popover').forEach(node => node.remove());
  document.querySelectorAll('.bjob-phase2-trigger.open').forEach(node => node.classList.remove('open'));
}

function openGroup(group, routes, trigger) {
  closePopover();
  trigger.classList.add('open');
  const popover = document.createElement('div');
  popover.className = 'bjob-phase2-popover';
  routes.forEach(route => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = route.label;
    button.addEventListener('click', event => {
      event.stopPropagation();
      closePopover();
      navigate(route.id);
    });
    popover.appendChild(button);
  });
  document.body.appendChild(popover);
  const place = () => {
    const rect = trigger.getBoundingClientRect();
    const width = popover.offsetWidth;
    const left = Math.min(Math.max(8, rect.left), Math.max(8, innerWidth - width - 8));
    const top = Math.min(rect.bottom + 5, Math.max(8, innerHeight - popover.offsetHeight - 8));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  };
  place();
  window.addEventListener('resize', place, { once: true });
  window.addEventListener('scroll', place, { once: true, capture: true });
}

async function renderOwnScreen(route) {
  const content = document.querySelector('#content');
  if (!content) return false;
  const current = session();
  const titles = {
    shops: ['Магазины', 'Магазины организации и активное рабочее пространство.'],
    workspace: ['Рабочие пространства и личные кабинеты', 'Управление рабочими пространствами и персональными кабинетами.'],
    prices: ['Цены и скидки', 'Ценообразование и правила скидок.'],
    tables: ['Таблицы', 'Рабочие таблицы и подготовленные наборы данных.'],
    'supplies-fbs': ['Поставки FBS', 'Отдельный рабочий раздел поставок FBS.'],
    lan: ['Интеграция по LAN', 'Локальный обмен между рабочими местами.'],
    sync: ['Синхронизация', 'Синхронизация данных и состояние локального хранилища.'],
    access: ['Персональный доступ', 'Права и персональный доступ текущего пользователя.'],
    history: ['История изменений', 'Журнал изменений рабочего пространства.'],
    settings: ['Настройки', 'Настройки приложения и текущего рабочего пространства.'],
    organization: ['Организация', 'Организация, роли и права доступа.'],
    users: ['Сотрудники', 'Пользователи и доступ к рабочим пространствам.'],
    backup: ['Резервные копии', 'Экспорт и восстановление локальной базы.'],
    production: ['Производство', 'Производственные операции и планирование.'],
    'sales-history': ['История продаж', 'История фактических продаж и операций.'],
    api: ['Интеграция по API', 'Подключения маркетплейсов и API-настройки.']
  };
  const [title, description] = titles[route.id] || [route.label, 'Раздел B-JOB.'];
  let extra = '';
  if (route.id === 'shops') {
    const shops = await listShops();
    const active = await activeShop();
    extra = `<div class="bjob-phase2-grid">${shops.map(shop => `<section class="bjob-phase2-card"><h2>${esc(shop.name)}</h2><p>${esc(shop.marketplace || '')}</p><p>${shop.id === active?.id ? '● Активный магазин' : 'Доступен для переключения'}</p><button type="button" data-phase2-shop="${esc(shop.id)}">Сделать активным</button></section>`).join('') || '<section class="bjob-phase2-card"><h2>Нет магазинов</h2><p>Добавьте магазин в организации.</p></section>'}</div>`;
    setTimeout(() => content.querySelectorAll('[data-phase2-shop]').forEach(button => button.addEventListener('click', async () => { await setActiveShop(button.dataset.phase2Shop); location.reload(); })), 0);
  } else if (route.id === 'users' || route.id === 'organization') {
    extra = '<div class="bjob-phase2-note">Этот системный экран является самостоятельным маршрутом. Административные операции будут подключены к единому Core в следующем шаге.</div>';
  } else if (route.id === 'backup') {
    extra = '<div class="bjob-phase2-grid"><section class="bjob-phase2-card"><h2>JSON</h2><p>Резервное копирование локальной базы.</p><button type="button" id="phase2-backup">Создать резервную копию</button></section></div>';
    setTimeout(() => document.getElementById('phase2-backup')?.addEventListener('click', () => document.querySelector('#backup')?.click()), 0);
  }
  content.innerHTML = `<div class="bjob-phase2-screen"><small>${esc(route.group)}</small><h1>${esc(title)}</h1><p>${esc(description)}</p>${extra}</div>`;
  localStorage.setItem('bjob:page', route.id);
  return true;
}

async function navigate(id) {
  const route = ROUTES.find(item => item.id === id);
  if (!route || !allowed(route)) return;
  const own = ['shops','workspace','prices','tables','supplies-fbs','lan','sync','access','history','settings','organization','users','backup','production','sales-history','api'];
  if (own.includes(id) && !route.legacy) {
    await renderOwnScreen(route);
    return;
  }
  if (route.legacy) {
    const button = legacyButton(route);
    if (button) {
      button.click();
      localStorage.setItem('bjob:page', route.id);
      return;
    }
    await renderOwnScreen(route);
  }
}

async function render() {
  if (!session()) return;
  addStyles();
  hideLegacyShell();
  closePopover();
  document.getElementById(NAV_ID)?.remove();
  const nav = document.createElement('header');
  nav.id = NAV_ID;
  nav.className = 'bjob-phase2-shell';
  const inner = document.createElement('div');
  inner.className = 'bjob-phase2-inner';
  inner.innerHTML = '<div class="bjob-phase2-brand">B-JOB</div>';
  const groups = document.createElement('div');
  groups.className = 'bjob-phase2-groups';
  GROUPS.forEach(groupName => {
    const routes = ROUTES.filter(route => route.group === groupName && allowed(route));
    if (!routes.length) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'bjob-phase2-group';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'bjob-phase2-trigger';
    trigger.textContent = groupName;
    trigger.addEventListener('click', event => { event.stopPropagation(); openGroup(wrapper, routes, trigger); });
    wrapper.appendChild(trigger);
    groups.appendChild(wrapper);
  });
  inner.appendChild(groups);
  const tools = document.createElement('div');
  tools.className = 'bjob-phase2-tools';
  const shops = (await listShops()).filter(shop => session().role === 'admin' || session().shopIds?.includes(shop.id));
  if (shops.length) {
    const current = await activeShop();
    const holder = document.createElement('label');
    holder.className = 'bjob-phase2-shop';
    holder.innerHTML = `<select aria-label="Активный магазин">${shops.map(shop => `<option value="${esc(shop.id)}" ${shop.id === current?.id ? 'selected' : ''}>${esc(shop.name)} · ${esc(shop.marketplace || '')}</option>`).join('')}</select>`;
    holder.querySelector('select').addEventListener('change', async event => { await setActiveShop(event.target.value); location.reload(); });
    tools.appendChild(holder);
  }
  const user = document.createElement('span');
  user.className = 'bjob-phase2-user';
  user.textContent = `${esc(session().name || session().login || '')} · ${ROLE_LABEL[session().role] || session().role || ''}`;
  tools.appendChild(user);
  inner.appendChild(tools);
  nav.appendChild(inner);
  const shell = document.querySelector('.app-shell');
  if (shell) shell.insertBefore(nav, shell.firstChild);
  else document.body.prepend(nav);
  mounted = true;
}

function scheduleRender() {
  if (mounted && document.getElementById(NAV_ID)) return;
  setTimeout(() => render().catch(error => console.error('B-JOB navigation render failed', error)), 0);
}

window.BJobNavigate = navigate;
window.addEventListener('bjob:ready', scheduleRender);
window.addEventListener('bjob:auth-ready', scheduleRender);
document.addEventListener('click', event => { if (!event.target.closest('.bjob-phase2-group')) closePopover(); });

observer = new MutationObserver(() => { if (!document.getElementById(NAV_ID) && session()) scheduleRender(); });
observer.observe(document.body, { childList: true, subtree: true });
scheduleRender();
