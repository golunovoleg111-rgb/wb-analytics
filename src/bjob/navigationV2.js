import {session,can,listShops,activeShop,setActiveShop} from './userAuth.js';

const GROUPS=[
  ['БИЗНЕС',['overview','analytics','reports','products','unit','advertising']],
  ['ЛОГИСТИКА',['warehouses','shipments','fbs']],
  ['ОПЕРАЦИИ',['production','imports','tables','documents']],
  ['ИНТЕГРАЦИИ',['api','sync','lan','backup']],
  ['СИСТЕМА',['settings','users','organization']]
];
const LABELS={overview:'Обзор',analytics:'Аналитика',reports:'Отчёты',products:'Товары',unit:'Юнит-экономика',advertising:'Реклама',warehouses:'Склады',shipments:'Поставки',fbs:'FBS',production:'Производство',imports:'Импорт данных',tables:'Таблицы',documents:'Документы',api:'WB API',sync:'Синхронизация',lan:'LAN',backup:'Резервные копии',settings:'Настройки',users:'Пользователи',organization:'Организация'};
const ROLE_LABEL={admin:'Администратор',leader:'Руководитель',manager:'Менеджер',warehouse:'Склад',production:'Производство'};
const STYLE_ID='bjob-navigation-v2-style';
const POPOVER_CLASS='bjob-nav-v2-popover';

function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
function allowed(id){const s=session();if(!s)return false;if(id==='users'||id==='organization'||id==='settings')return s.role==='admin'||can(id,'view');return can(id,'view')}
function route(id){return ({imports:'import',tables:'reports',documents:'reports',backup:'reports',sync:'settings',lan:'settings'}[id]||id)}

function style(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
  .bjob-nav-v2{position:sticky;top:72px;z-index:1000;background:rgba(255,255,255,.98);border-bottom:1px solid #e2e4e8;box-shadow:0 2px 12px #1111}
  .bjob-nav-v2-inner{max-width:1440px;margin:auto;padding:8px 34px;display:flex;gap:8px;align-items:center;overflow-x:auto;overflow-y:hidden}
  .bjob-nav-v2-group{position:relative;flex:0 0 auto}
  .bjob-nav-v2-group>button{border:1px solid transparent;background:#fff;border-radius:9px;padding:9px 12px;color:#555b64;cursor:pointer;white-space:nowrap;font-weight:600}
  .bjob-nav-v2-group>button:hover,.bjob-nav-v2-group.open>button{background:#f4f5f7;color:#111}
  .bjob-nav-v2-tools{margin-left:auto;display:flex;gap:6px;align-items:center;flex:0 0 auto}
  .bjob-nav-v2-tools button{border:1px solid #e2e4e8;background:#fff;border-radius:9px;padding:8px 10px;cursor:pointer;white-space:nowrap}
  .bjob-nav-v2-popover{position:fixed;z-index:20000;min-width:220px;max-width:min(320px,calc(100vw - 20px));padding:6px;background:#fff;border:1px solid #e2e4e8;border-radius:12px;box-shadow:0 18px 45px #1113;display:grid;gap:2px}
  .bjob-nav-v2-popover button{border:0;background:#fff;text-align:left;padding:10px 11px;border-radius:8px;cursor:pointer;color:#333}
  .bjob-nav-v2-popover button:hover,.bjob-nav-v2-popover button.active{background:#f0f1f3;font-weight:600}
  .bjob-user-status{font-size:11px;color:#747981;white-space:nowrap}
  .bjob-shop-chip{display:flex;align-items:center;gap:6px;border:1px solid #e2e4e8;background:#fff;border-radius:9px;padding:7px 9px;font-size:12px;white-space:nowrap}
  .bjob-shop-chip select{border:0;background:transparent;font:inherit;outline:0}
  .bjob-admin-hub{position:fixed;right:18px;top:84px;z-index:21000;background:#fff;border:1px solid #e2e4e8;border-radius:14px;box-shadow:0 18px 45px #1113;padding:8px;display:none;min-width:210px}
  .bjob-admin-hub.open{display:grid;gap:5px}
  .bjob-admin-hub button{border:0;background:#fff;text-align:left;padding:9px;border-radius:8px;cursor:pointer}
  .bjob-admin-hub button:hover{background:#f3f4f6}
  @media(max-width:900px){.bjob-nav-v2{top:64px}.bjob-nav-v2-inner{padding:8px 14px}.bjob-nav-v2-tools{margin-left:0}.bjob-nav-v2-group>button{padding:8px 10px}}
  `;document.head.appendChild(s);
}

function findLegacyButton(id){const target=route(id);return [...document.querySelectorAll('#mainNav [data-page],nav [data-page]')].find(b=>b.dataset.page===target)}
function closePopover(){document.querySelectorAll(`.${POPOVER_CLASS}`).forEach(x=>x.remove());document.querySelectorAll('.bjob-nav-v2-group.open').forEach(x=>x.classList.remove('open'))}
function openPopover(group,ids){
  closePopover();group.classList.add('open');
  const pop=document.createElement('div');pop.className=POPOVER_CLASS;
  for(const id of ids){const b=document.createElement('button');b.textContent=LABELS[id]||id;b.dataset.page=id;b.onclick=e=>{e.stopPropagation();closePopover();navigate(id)};pop.appendChild(b)}
  document.body.appendChild(pop);
  const trigger=group.querySelector(':scope>button');
  const place=()=>{const r=trigger.getBoundingClientRect();const width=pop.offsetWidth;const left=Math.min(Math.max(8,r.left),Math.max(8,window.innerWidth-width-8));const top=Math.min(r.bottom+5,Math.max(8,window.innerHeight-pop.offsetHeight-8));pop.style.left=`${left}px`;pop.style.top=`${top}px`};
  place();pop._place=place;
}

async function navigate(id){
  const adminHub=document.querySelector('.bjob-admin-hub');
  if(id==='users'||id==='organization'){const target=id==='users'?'users':'org';if(adminHub){adminHub.classList.add('open');adminHub.querySelector(`[data-admin="${target}"]`)?.click();}else document.querySelector(`.bjob-admin-fixed [data-${target}]`)?.click();return}
  const b=findLegacyButton(id);
  if(b){b.click();return}
  if(typeof window.BJobNavigate==='function'){await window.BJobNavigate(route(id));return}
  window.dispatchEvent(new CustomEvent('bjob:navigate',{detail:{page:route(id)}}));
}

async function shopChip(){const s=session();if(!s)return '';const shops=(await listShops()).filter(x=>s.role==='admin'||s.shopIds?.includes(x.id));if(!shops.length)return '';const current=await activeShop();return `<div class="bjob-shop-chip">🏪 <select aria-label="Активный магазин">${shops.map(x=>`<option value="${esc(x.id)}" ${x.id===current?.id?'selected':''}>${esc(x.name)} · ${x.marketplace==='wb'?'WB':'Ozon'}</option>`).join('')}</select></div>`}

async function adminHub(){
  const s=session();if(!s||s.role!=='admin')return;
  let hub=document.querySelector('.bjob-admin-hub');
  if(!hub){hub=document.createElement('div');hub.className='bjob-admin-hub';hub.innerHTML='<button data-admin="shops">🏪 Магазины</button><button data-admin="users">👥 Сотрудники</button><button data-admin="org">⚙️ Организация и права</button>';document.body.appendChild(hub);}
  if(!hub.dataset.bound){hub.dataset.bound='1';hub.addEventListener('click',e=>{const b=e.target.closest('[data-admin]');if(!b)return;const target=b.dataset.admin;const selector=target==='org'?'.bjob-admin-fixed [data-org]':`.bjob-admin-fixed [data-${target}]`;document.querySelector(selector)?.click();});}
}

async function render(){
  const s=session();if(!s)return;style();closePopover();
  const old=document.querySelector('.bjob-nav-v2');if(old)old.remove();
  const nav=document.createElement('div');nav.className='bjob-nav-v2';
  const inner=document.createElement('div');inner.className='bjob-nav-v2-inner';
  for(const [title,ids] of GROUPS){const visible=ids.filter(allowed);if(!visible.length)continue;const group=document.createElement('div');group.className='bjob-nav-v2-group';const trigger=document.createElement('button');trigger.textContent=title+' ▾';trigger.onclick=e=>{e.stopPropagation();openPopover(group,visible)};group.appendChild(trigger);inner.appendChild(group)}
  const tools=document.createElement('div');tools.className='bjob-nav-v2-tools';
  const chip=document.createElement('div');chip.innerHTML=await shopChip();if(chip.firstElementChild){chip.firstElementChild.querySelector('select').onchange=async e=>{await setActiveShop(e.target.value);location.reload()};tools.appendChild(chip.firstElementChild)}
  if(s.role==='admin'){const a=document.createElement('button');a.textContent='⚙ Админ';a.onclick=e=>{e.stopPropagation();document.querySelector('.bjob-admin-hub')?.classList.toggle('open')};tools.appendChild(a)}
  const u=document.createElement('span');u.className='bjob-user-status';u.textContent=`${s.name} · ${ROLE_LABEL[s.role]||s.role}`;tools.appendChild(u);inner.appendChild(tools);nav.appendChild(inner);
  const app=document.querySelector('#app .bjob');
  if(app){const legacy=app.querySelector('nav');if(legacy)legacy.style.display='none';const main=app.querySelector('main');app.insertBefore(nav,main||app.firstChild)}else document.body.prepend(nav);
  await adminHub();
}

let scheduled=false;
function ensure(){if(scheduled)return;scheduled=true;queueMicrotask(async()=>{scheduled=false;const s=session();if(!s)return;const legacy=document.querySelector('#app .bjob>nav');const nav=document.querySelector('.bjob-nav-v2');if(!nav||legacy?.style.display!=='none')await render();});}

function observe(){
  ensure();
  new MutationObserver(()=>ensure()).observe(document.body,{subtree:true,childList:true});
  window.addEventListener('resize',()=>document.querySelectorAll(`.${POPOVER_CLASS}`).forEach(x=>x._place?.()));
  window.addEventListener('scroll',()=>document.querySelectorAll(`.${POPOVER_CLASS}`).forEach(x=>x._place?.()),true);
  document.addEventListener('click',e=>{if(!e.target.closest('.bjob-nav-v2-group')&&!e.target.closest(`.${POPOVER_CLASS}`))closePopover()});
}

observe();
