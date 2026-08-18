import * as DB from '../db.js';

const REFRESH_MS = 5 * 60 * 1000;
let mounted = false;
let refreshTimer = null;
let mode = 'manager';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = p => `${p}-${crypto.randomUUID()}`;
const activeShop = () => localStorage.getItem('bjob:v2:active-shop') || null;

async function apiStatus(){
  try {
    const rows = await DB.all('apiConnections');
    const active = rows.find(x => x.active !== false && (x.status === 'connected' || x.connected === true));
    if(active) return {label:'API', state:'online', detail:`${String(active.marketplace || 'API').toUpperCase()} подключён`};
  } catch {}
  if(window.BJobDesktop?.lan?.connected || window.bjobLan?.connected) return {label:'LAN', state:'online', detail:'Локальная сеть подключена'};
  return {label:'OFFLINE', state:'offline', detail:'Локальные данные'};
}

async function listOrders(){
  try { return await DB.all('orders'); } catch { return []; }
}
async function listTasks(){
  try { return (await DB.all('assemblyTasks')).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))); } catch { return []; }
}

function statusPill(s){
  const labels={NEW:'Новое',ROADMAP:'ROADMAP готов',PICKING:'В сборке',CHECK:'Проверка',READY:'Готово',SENT:'Отправлено',DONE:'Завершено'};
  return `<span class="assembly-status ${esc(s||'NEW')}">${esc(labels[s]||s||'Новое')}</span>`;
}

function shell(body,status){
  return `<section class="page assembly-page"><div class="page-head"><div><div class="eyebrow">B-JOB / Сборочные задания</div><h1>Сборочные задания</h1><p>Заказ → задание → ROADMAP → складская сборка.</p></div><div class="assembly-connection"><b>${esc(status.label)}</b><span>${esc(status.detail)}</span></div></div><div class="assembly-tabs"><button class="ui-btn ${mode==='manager'?'active':''}" data-assembly-mode="manager">Менеджер</button><button class="ui-btn ${mode==='warehouse'?'active':''}" data-assembly-mode="warehouse">Склад</button><button class="ui-btn ghost" data-assembly-back>← Перемещения</button></div>${body}</section>`;
}

async function managerView(){
  const orders=await listOrders();
  const tasks=await listTasks();
  const activeTasks=tasks.filter(x=>!['DONE','SENT'].includes(x.status)).length;
  const rows=orders.map((o,i)=>{
    const lines=Array.isArray(o.lines)?o.lines:(Array.isArray(o.items)?o.items:[o]);
    const first=lines[0]||{};
    const id=o.id||`order-${i}`;
    return `<article class="assembly-order"><label><input type="checkbox" data-order-check value="${esc(id)}"><span><b>Заказ ${esc(o.orderNumber||o.number||id)}</b><small>${esc(first.name||first.article||first.sku||'Позиция')} · ${esc(first.quantity||o.quantity||1)} шт.</small></span></label><span>${esc(o.status||'Новый')}</span></article>`;
  }).join('');
  return shell(`<div class="assembly-metrics"><div><span>Заказов</span><b>${orders.length}</b></div><div><span>Активных заданий</span><b>${activeTasks}</b></div><div><span>Обновление</span><b>5 мин</b></div></div><div class="action-row"><button class="ui-btn" data-assembly-refresh>Обновить сейчас</button><button class="ui-btn primary" data-create-assembly>Сформировать сборочное задание</button></div><div class="assembly-list">${rows||'<div class="empty-panel"><b>Заказов пока нет</b><p>При подключении API заказы появятся здесь. Можно также загрузить их в локальную таблицу заказов.</p></div>'}</div><div class="empty-panel"><b>Логика менеджера</b><p>Выберите нужные заказы, сформируйте задание и отправьте его на склад. Автообновление выполняется каждые 5 минут.</p></div>`,await apiStatus());
}

async function warehouseView(){
  const tasks=await listTasks();
  const cards=tasks.map(t=>`<article class="assembly-task"><div><b>Задание ${esc(t.number||t.id)}</b><small>${esc(t.status||'NEW')} · ${new Date(t.createdAt||Date.now()).toLocaleString('ru-RU')}</small></div><div>${statusPill(t.status)}</div><div class="action-row">${t.status==='NEW'?'<button class="ui-btn" data-build-roadmap="'+esc(t.id)+'">Сформировать ROADMAP</button>':''}${['ROADMAP','PICKING'].includes(t.status)?'<button class="ui-btn primary" data-start-pick="'+esc(t.id)+'">Открыть сборку</button>':''}</div></article>`).join('');
  return shell(`<div class="assembly-metrics"><div><span>Получено заданий</span><b>${tasks.length}</b></div><div><span>В сборке</span><b>${tasks.filter(x=>x.status==='PICKING').length}</b></div><div><span>Готово</span><b>${tasks.filter(x=>['READY','DONE','SENT'].includes(x.status)).length}</b></div></div><div class="assembly-list">${cards||'<div class="empty-panel"><b>Нет входящих заданий</b><p>Когда менеджер отправит задание, оно появится здесь.</p></div>'}</div>`,await apiStatus());
}

async function roadmap(task){
  const lines=Array.isArray(task.lines)?task.lines:[];
  const boxes=await DB.all('boxes');
  const roadmap=[];
  for(const line of lines){
    let remaining=Math.max(0,Number(line.quantity||0)-Number(line.pickedQty||0));
    const candidates=boxes.filter(b=>b.locked!==true).filter(b=>{
      const contents=b.contents||b.items||b.products||[];
      return Array.isArray(contents) && contents.some(x=>String(x.article||x.sku||x.variantId||'')===String(line.article||line.sku||line.variantId||''));
    });
    for(const box of candidates){
      if(!remaining)break;
      const contents=box.contents||box.items||box.products||[];
      const found=contents.find(x=>String(x.article||x.sku||x.variantId||'')===String(line.article||line.sku||line.variantId||''));
      const available=Number(found?.quantity ?? found?.qty ?? 0);
      const take=Math.min(remaining,Math.max(0,available));
      if(take) { roadmap.push({lineId:line.id,boxId:box.id,address:box.address||box.location||box.cell||'Без адреса',article:line.article||line.sku||line.variantId,quantity:take}); remaining-=take; }
    }
    if(remaining) roadmap.push({lineId:line.id,boxId:null,address:'Не найдено',article:line.article||line.sku||line.variantId,quantity:remaining,missing:true});
  }
  return roadmap;
}

async function buildRoadmap(id){
  const task=await DB.get('assemblyTasks',id); if(!task)throw new Error('Задание не найдено.');
  const plan=await roadmap(task);
  await DB.put('assemblyTasks',{...task,status:'ROADMAP',roadmap:plan,roadmapCreatedAt:new Date().toISOString()});
  return plan;
}

async function createTask(){
  const ids=[...document.querySelectorAll('[data-order-check]:checked')].map(x=>x.value);
  if(!ids.length)throw new Error('Выберите хотя бы один заказ.');
  const orders=await listOrders();
  const selected=orders.filter(o=>ids.includes(String(o.id)));
  const lines=[];
  for(const order of selected){
    const source=Array.isArray(order.lines)?order.lines:(Array.isArray(order.items)?order.items:[order]);
    for(const item of source){
      const quantity=Number(item.quantity||item.qty||1);
      const key=String(item.variantId||item.sku||item.article||item.id||item.name||'unknown');
      const existing=lines.find(x=>x.key===key);
      if(existing)existing.quantity+=quantity;
      else lines.push({id:uid('line'),key,variantId:item.variantId||null,sku:item.sku||null,article:item.article||null,name:item.name||item.article||item.sku||'Позиция',quantity,pickedQty:0});
    }
  }
  const task={id:uid('assembly'),number:`ASM-${Date.now()}`,shopId:activeShop(),sourceOrderIds:ids,lines,status:'NEW',createdAt:new Date().toISOString(),createdBy:'manager'};
  await DB.put('assemblyTasks',task); await DB.put('assemblyEvents',{id:uid('assembly-event'),taskId:task.id,type:'created',date:new Date().toISOString(),details:{orderIds:ids}}); return task;
}

async function openPick(id){
  const task=await DB.get('assemblyTasks',id); if(!task)throw new Error('Задание не найдено.');
  if(!task.roadmap) await buildRoadmap(id);
  const fresh=await DB.get('assemblyTasks',id);
  const view=document.querySelector('#view');
  const rows=(fresh.roadmap||[]).map((r,i)=>`<article class="assembly-pick"><div><b>${esc(r.article)}</b><small>${esc(r.address)} · ${r.boxId?`Короб ${esc(r.boxId)}`:'Источник не найден'}</small></div><strong>${esc(r.quantity)} шт.</strong>${r.missing?'<span class="assembly-warning">Не найдено на складе</span>':'<button class="ui-btn" data-take-line="'+esc(r.lineId)+'" data-box-id="'+esc(r.boxId||'')+'">Взять 1</button>'}</article>`).join('');
  view.innerHTML=shell(`<div class="empty-panel"><b>${esc(fresh.number)}</b><p>ROADMAP сформирован по адресам хранения. При сканировании короба операция должна ссылаться на конкретный boxId.</p></div><div class="assembly-list">${rows}</div><div class="action-row"><button class="ui-btn primary" data-finish-assembly="${esc(fresh.id)}">Завершить сборку</button></div>`,await apiStatus());
  bindAssembly();
}

async function takeLine(lineId,boxId){
  const tasks=await listTasks();
  const task=tasks.find(t=>['ROADMAP','PICKING'].includes(t.status) && (t.roadmap||[]).some(r=>r.lineId===lineId && String(r.boxId)===String(boxId)));
  if(!task)throw new Error('Строка сборки не найдена.');
  const line=task.lines.find(x=>x.id===lineId); if(!line)throw new Error('Позиция не найдена.');
  const roadmapLine=task.roadmap.find(x=>x.lineId===lineId&&String(x.boxId)===String(boxId));
  const already=Number(line.pickedQty||0); const target=Number(line.quantity||0); if(already>=target)throw new Error('Позиция уже собрана.');
  line.pickedQty=already+1; task.status='PICKING';
  await DB.put('assemblyTasks',{...task,lines:task.lines});
  await DB.put('assemblyEvents',{id:uid('assembly-event'),taskId:task.id,type:'pick',date:new Date().toISOString(),boxId,lineId,quantity:1,article:line.article||line.sku||line.variantId});
  await openPick(task.id);
}

async function finish(id){
  const task=await DB.get('assemblyTasks',id); if(!task)throw new Error('Задание не найдено.');
  const complete=task.lines.every(x=>Number(x.pickedQty||0)>=Number(x.quantity||0));
  if(!complete)throw new Error('Нельзя завершить: часть позиций ещё не собрана.');
  await DB.put('assemblyTasks',{...task,status:'READY',completedAt:new Date().toISOString()});
  await DB.put('assemblyEvents',{id:uid('assembly-event'),taskId:id,type:'ready',date:new Date().toISOString()});
  renderAssembly();
}

function bindAssembly(){
  document.querySelectorAll('[data-assembly-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.assemblyMode;renderAssembly()});
  document.querySelector('[data-assembly-back]')?.addEventListener('click',()=>{window.__bjobAssemblyOpen=false;const nav=[...document.querySelectorAll('[data-route]')].find(x=>x.dataset.route==='transfers');nav?.click()});
  document.querySelector('[data-assembly-refresh]')?.addEventListener('click',()=>renderAssembly());
  document.querySelector('[data-create-assembly]')?.addEventListener('click',async()=>{try{const t=await createTask();toast(`Задание ${t.number} создано и отправлено на склад.`);mode='warehouse';renderAssembly()}catch(e){toast(e.message,true)}});
  document.querySelectorAll('[data-build-roadmap]').forEach(b=>b.onclick=async()=>{try{await buildRoadmap(b.dataset.buildRoadmap);renderAssembly()}catch(e){toast(e.message,true)}});
  document.querySelectorAll('[data-start-pick]').forEach(b=>b.onclick=()=>openPick(b.dataset.startPick).catch(e=>toast(e.message,true)));
  document.querySelectorAll('[data-take-line]').forEach(b=>b.onclick=()=>takeLine(b.dataset.takeLine,b.dataset.boxId).catch(e=>toast(e.message,true)));
  document.querySelector('[data-finish-assembly]')?.addEventListener('click',()=>finish(document.querySelector('[data-finish-assembly]').dataset.finishAssembly).catch(e=>toast(e.message,true)));
}

async function renderAssembly(){
  const view=document.querySelector('#view'); if(!view)return;
  window.__bjobAssemblyOpen=true;
  view.innerHTML=mode==='manager'?await managerView():await warehouseView();
  bindAssembly();
}

function decorateTransfers(){
  if(localStorage.getItem('bjob:route')!=='transfers' || window.__bjobAssemblyOpen)return;
  const view=document.querySelector('#view'); if(!view || view.querySelector('[data-open-assembly]'))return;
  const head=view.querySelector('.page-head'); if(!head)return;
  const button=document.createElement('button');button.className='ui-btn primary';button.dataset.openAssembly='1';button.textContent='Сборочные задания';
  (head.querySelector('.action-row')||head).appendChild(button); button.addEventListener('click',()=>{mode='manager';renderAssembly()});
}

export function startAssemblyLayer(){
  if(mounted)return; mounted=true;
  const observer=new MutationObserver(()=>decorateTransfers());
  observer.observe(document.body,{childList:true,subtree:true});
  decorateTransfers();
  clearInterval(refreshTimer);
  refreshTimer=setInterval(()=>{if(window.__bjobAssemblyOpen && mode==='manager')renderAssembly().catch(()=>{});},REFRESH_MS);
}
