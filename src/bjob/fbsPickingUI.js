import * as DB from '../db.js';
import {createFbsShipment,scanShipmentItem,getPickingProgress,beginLabeling,addLabel,getLabelProgress,readyShipment,shipShipment,buildPickPlan,pickFromBox,getUnfulfilledItems,createShipmentSummary} from './domain/fbsPicking.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number(v||0).toLocaleString('ru-RU');
const statusText={new:'Новая',picking:'Сборка',packed:'Собрано',labeling:'Проклейка',ready:'Готова к отгрузке',shipped:'Отгружена',cancelled:'Отменена'};
let shipmentId=null;
let selectedBoxId=null;
let scannerValue='';

async function getShipment(){
  if(!shipmentId)return null;
  const rows=await DB.all('fbs');
  return rows.find(x=>x.id===shipmentId)||null;
}

async function createShipmentFromOrders(){
  const orders=await DB.all('fbs');
  const source=orders.filter(x=>x.status!=='cancelled'&&x.status!=='shipped'&&!x.items&&!x.scanned);
  if(!source.length){alert('Нет FBS-заказов, ожидающих сборки.');return null;}
  const grouped=new Map();
  source.forEach(x=>{
    const key=x.variantId||x.barcode||x.article;
    if(!key)return;
    const cur=grouped.get(key)||{variantId:key,article:x.article,size:x.size,color:x.color,barcode:x.barcode,quantity:0};
    cur.quantity+=Number(x.quantity||1);
    grouped.set(key,cur);
  });
  const shipment=createFbsShipment({id:`fbs-shipment-${Date.now()}`,number:`FBS-${Date.now()}`,items:[...grouped.values()]});
  await DB.put('fbs',shipment);
  shipmentId=shipment.id;
  selectedBoxId=null;
  return shipment;
}

async function scanProduct(shipment,boxes,code){
  const box=boxes.find(x=>x.id===selectedBoxId||x.barcode===selectedBoxId);
  if(!box)throw new Error('Сначала выберите доступную коробку.');
  const value=String(code||'').trim();
  if(!value)throw new Error('Штрихкод товара не указан.');
  const item=(box.items||[]).find(x=>x.barcode===value||x.variantId===value||x.article===value);
  if(!item)throw new Error('Товар с этим кодом не найден в выбранной коробке.');
  const nextShipment=scanShipmentItem(shipment,item,{boxId:box.id,barcode:value});
  const nextBox=pickFromBox(box,item.variantId,1);
  await DB.put('fbs',nextShipment);
  await DB.put('fbsBoxes',nextBox);
  return nextShipment;
}

function renderItemList(shipment){
  const scanned=new Map();
  (shipment.scanned||[]).forEach(x=>scanned.set(x.variantId,(scanned.get(x.variantId)||0)+Number(x.quantity||0)));
  return shipment.items.map(x=>{
    const done=scanned.get(x.variantId)||0;
    return `<div class="fbs-item-row"><span><b>${esc(x.article||x.variantId)}</b><small>${esc([x.color,x.size].filter(Boolean).join(' / '))}</small></span><strong>${n(done)} / ${n(x.quantity)}</strong></div>`;
  }).join('');
}

function renderLabels(shipment){
  const labels=shipment.labels||[];
  return labels.length?labels.slice().reverse().slice(0,8).map(x=>`<div class="fbs-label-row"><span>${esc(x.variantId)}</span><code>${esc(x.labelCode)}</code></div>`).join(''):'<div class="fbs-empty">Стикеры ещё не отсканированы.</div>';
}

async function render(){
  const view=document.querySelector('#view');
  if(!view)return;
  const shipment=await getShipment();
  if(!shipment){
    view.querySelector('.fbs-picking-panel')?.remove();
    return;
  }
  const boxes=await DB.all('fbsBoxes');
  const plan=buildPickPlan(shipment,boxes);
  const p=getPickingProgress(shipment);
  const lp=getLabelProgress(shipment);
  const summary=createShipmentSummary(shipment);
  const shortage=getUnfulfilledItems(shipment);
  let panel=view.querySelector('.fbs-picking-panel');
  if(!panel){panel=document.createElement('section');panel.className='fbs-picking-panel';view.prepend(panel);}
  const scanBox=selectedBoxId?boxes.find(x=>x.id===selectedBoxId||x.barcode===selectedBoxId):null;
  const scanDisabled=!scanBox||!['new','picking'].includes(shipment.status);
  const canLabel=shipment.status==='packed';
  const canShip=shipment.status==='ready';
  const shortageText=shortage.length?`<div class="fbs-warning"><b>⚠️ Не хватает товара</b><span>${shortage.map(x=>`${esc(x.article||x.variantId)}: ${n(x.remaining)} шт.`).join(' · ')}</span></div>`:'';

  panel.innerHTML=`
    <div class="fbs-picking-head">
      <div><small>FBS / СБОРКА ПОСТАВКИ</small><h2>${esc(shipment.number)}</h2><p>Статус: <b>${esc(statusText[shipment.status]||shipment.status)}</b></p></div>
      <div class="fbs-picking-actions">
        ${canLabel?'<button class="btn primary" data-fbs-action="label">Проклеить поставку</button>':''}
        ${canShip?'<button class="btn primary" data-fbs-action="ship">Поставка готова / Отгрузить</button>':''}
        <button class="btn secondary" data-fbs-action="close">Закрыть</button>
      </div>
    </div>
    <div class="fbs-picking-stats">
      <div><small>К сборке</small><b>${n(summary.required)}</b></div>
      <div><small>Собрано</small><b>${n(summary.scanned)}</b></div>
      <div><small>Осталось</small><b>${n(summary.remaining)}</b></div>
      <div><small>Стикеры</small><b>${n(summary.labels)} / ${n(summary.required)}</b></div>
    </div>
    <div class="fbs-picking-progress"><div style="width:${p.percent}%"></div></div>
    ${shortageText}
    <div class="fbs-picking-grid">
      <div class="fbs-route-col">
        <h3>1. Маршрут по складу</h3>
        ${plan.length?plan.map((x,i)=>`<button class="pick-step ${selectedBoxId===x.boxId?'active':''}" data-pick-box="${esc(x.boxId)}"><b>${i+1}. Коробка ${esc(x.boxId)}</b><span>ряд ${esc(x.coordinates?.row)} · позиция ${esc(x.coordinates?.position)} · уровень ${esc(x.coordinates?.level)}</span><small>${x.items.map(y=>`${esc(y.article||y.variantId)} × ${n(y.quantity)}`).join(' · ')}</small></button>`).join(''):'<p class="fbs-empty">Нет доступных коробок с нужным товаром. Проверьте размещение и физическую блокировку.</p>'}
      </div>
      <div class="fbs-scan-col">
        <h3>2. Сканирование</h3>
        <p>${scanBox?`Коробка: <b>${esc(scanBox.name||scanBox.id)}</b>`:'Выберите коробку слева.'}</p>
        <div class="fbs-scanner"><input data-fbs-scanner placeholder="Штрихкод товара" inputmode="numeric" autocomplete="off" value="${esc(scannerValue)}" ${scanDisabled?'disabled':''}><button class="btn primary" data-fbs-action="scan" ${scanDisabled?'disabled':''}>Сканировать</button></div>
        <div class="fbs-hint">Можно использовать обычный USB/Bluetooth-сканер: он должен вводить код в поле и завершать ввод Enter.</div>
        <h3>3. Состав поставки</h3>
        <div class="fbs-item-list">${renderItemList(shipment)}</div>
      </div>
    </div>
    ${shipment.status==='labeling'?`<div class="fbs-labeling"><div><h3>4. Проклейка поставки</h3><p>Сканируйте WB-стикер на каждом подготовленном изделии.</p></div><div class="fbs-scanner"><input data-fbs-label placeholder="WB-стикер" autocomplete="off"><button class="btn primary" data-fbs-action="label-scan">Сканировать стикер</button></div><div class="fbs-label-list">${renderLabels(shipment)}</div></div>`:''}
    ${shipment.status==='ready'?'<div class="fbs-success">✅ Все товары собраны и промаркированы. Проверьте состав и нажмите «Поставка готова / Отгрузить».</div>':''}
  `;

  const scanner=panel.querySelector('[data-fbs-scanner]');
  scanner?.focus();
  scanner?.addEventListener('input',e=>{scannerValue=e.target.value;});
  scanner?.addEventListener('keydown',async e=>{if(e.key==='Enter'){e.preventDefault();panel.querySelector('[data-fbs-action="scan"]')?.click();}});
  panel.querySelector('[data-fbs-action="scan"]')?.addEventListener('click',async()=>{try{await scanProduct(shipment,boxes,scanner?.value);scannerValue='';await render();}catch(e){alert(e.message);scanner?.select();}});
  panel.querySelectorAll('[data-pick-box]').forEach(x=>x.addEventListener('click',async()=>{selectedBoxId=x.dataset.pickBox;await render();}));
  panel.querySelector('[data-fbs-action="label"]')?.addEventListener('click',async()=>{try{await DB.put('fbs',beginLabeling(shipment));await render();}catch(e){alert(e.message);}});
  panel.querySelector('[data-fbs-action="ship"]')?.addEventListener('click',async()=>{if(!confirm('Все товары проверены? Перевести поставку в статус «Отгружена»?'))return;try{await DB.put('fbs',shipShipment(shipment));await render();}catch(e){alert(e.message);}});
  panel.querySelector('[data-fbs-action="close"]')?.addEventListener('click',()=>{shipmentId=null;selectedBoxId=null;scannerValue='';panel.remove();});
  panel.querySelector('[data-fbs-action="label-scan"]')?.addEventListener('click',async()=>{const input=panel.querySelector('[data-fbs-label]');try{const labels=shipment.labels||[];const variant=shipment.items.find(i=>Number(i.quantity)>labels.filter(l=>l.variantId===i.variantId).length);if(!variant)throw new Error('Все товары уже промаркированы.');const code=String(input?.value||'').trim();if(!code)throw new Error('Введите или отсканируйте WB-стикер.');const next=addLabel(shipment,variant.variantId,code);await DB.put('fbs',getLabelProgress(next).complete?readyShipment(next):next);await render();}catch(e){alert(e.message);input?.select();}});
}

function addNavButton(){
  if(document.querySelector('[data-fbs-picking-nav]'))return;
  const nav=document.querySelector('#mainNav');
  if(!nav)return;
  const b=document.createElement('button');
  b.textContent='Сборка поставки';
  b.dataset.fbsPickingNav='1';
  b.className='fbs-picking-nav';
  b.addEventListener('click',async()=>{const existing=await DB.all('fbs');const active=existing.find(x=>x.id===shipmentId&&x.items);if(!active){await createShipmentFromOrders();}await render();});
  nav.appendChild(b);
}

async function watch(){addNavButton();if(shipmentId)await render();}
setTimeout(watch,100);
setInterval(watch,2500);
