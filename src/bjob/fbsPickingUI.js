import * as DB from '../db.js';
import {createFbsShipment,scanShipmentItem,getPickingProgress,beginLabeling,addLabel,getLabelProgress,readyShipment,shipShipment,buildPickPlan,pickFromBox} from './domain/fbsPicking.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number(v||0).toLocaleString('ru-RU');
let shipmentId=null; let selectedBoxId=null; let started=false;

async function createShipmentFromOrders(){
  const orders=await DB.all('fbs');
  const source=orders.filter(x=>x.status!=='cancelled'&&x.status!=='shipped'&&!x.items&&!x.scanned);
  if(!source.length){alert('Нет FBS-заказов, ожидающих сборки.');return}
  const grouped=new Map();
  source.forEach(x=>{const key=x.variantId||x.barcode||x.article;if(!key)return;const cur=grouped.get(key)||{variantId:key,article:x.article,size:x.size,color:x.color,barcode:x.barcode,quantity:0};cur.quantity+=Number(x.quantity||1);grouped.set(key,cur)});
  const shipment=createFbsShipment({id:`fbs-shipment-${Date.now()}`,number:`FBS-${Date.now()}`,items:[...grouped.values()]});
  await DB.put('fbs',shipment);shipmentId=shipment.id;selectedBoxId=null;await render();
}
async function scanProduct(shipment,boxes){
  const box=boxes.find(x=>x.id===selectedBoxId||x.barcode===selectedBoxId);
  if(!box){alert('Сначала выберите доступную коробку.');return}
  const code=prompt('Отсканируйте товар (штрихкод сканера вводится сюда):');
  if(!code)return;
  const item=(box.items||[]).find(x=>x.barcode===code||x.variantId===code||x.article===code);
  if(!item){alert('Товар с этим кодом не найден в выбранной коробке.');return}
  try{const nextShipment=scanShipmentItem(shipment,item,{boxId:box.id,barcode:code});const nextBox=pickFromBox(box,item.variantId,1);await DB.put('fbs',nextShipment);await DB.put('fbsBoxes',nextBox);await render()}catch(e){alert(e.message)}
}
async function render(){
  if(!shipmentId)return;
  const rows=await DB.all('fbs');const shipment=rows.find(x=>x.id===shipmentId);if(!shipment)return;
  const boxes=await DB.all('fbsBoxes');const plan=buildPickPlan(shipment,boxes);const p=getPickingProgress(shipment);const lp=getLabelProgress(shipment);
  let panel=document.querySelector('.fbs-picking-panel');if(!panel){panel=document.createElement('section');panel.className='fbs-picking-panel';document.querySelector('#view')?.prepend(panel)}
  const scanBox=selectedBoxId?boxes.find(x=>x.id===selectedBoxId||x.barcode===selectedBoxId):null;
  const statusText={new:'Новая',picking:'Сборка',packed:'Собрано',labeling:'Проклейка',ready:'Готова к отгрузке',shipped:'Отгружена'}[shipment.status]||shipment.status;
  panel.innerHTML=`<div class="fbs-picking-head"><div><small>FBS / СБОРКА</small><h2>Поставка ${esc(shipment.number)}</h2><p>Статус: <b>${esc(statusText)}</b> · собрано ${n(p.scanned)} из ${n(p.required)} · ${p.percent.toFixed(0)}%</p></div><div class="fbs-picking-actions">${shipment.status==='packed'?'<button class="btn primary" data-pick-action="label">Проклеить поставку</button>':''}${shipment.status==='ready'?'<button class="btn primary" data-pick-action="ship">Поставка готова / Отгрузить</button>':''}</div></div><div class="fbs-picking-progress"><div style="width:${p.percent}%"></div></div><div class="fbs-picking-grid"><div><h3>Маршрут сборки</h3>${plan.length?plan.map((x,i)=>`<button class="pick-step ${selectedBoxId===x.boxId?'active':''}" data-pick-box="${esc(x.boxId)}"><b>${i+1}. Коробка ${esc(x.boxId)}</b><span>ряд ${x.coordinates.row} · позиция ${x.coordinates.position} · уровень ${x.coordinates.level}</span><small>${x.items.map(y=>`${esc(y.article||y.variantId)} × ${y.quantity}`).join(' · ')}</small></button>`).join(''):'<p>Нет доступных коробок с нужным товаром. Проверьте размещение и блокировку коробок.</p>'}</div><div><h3>Сканирование</h3><p>${scanBox?`Выбрана: <b>${esc(scanBox.name||scanBox.id)}</b>`:'Выберите коробку из маршрута.'}</p><button class="btn secondary" data-pick-action="scan" ${selectedBoxId?'':'disabled'}>📷 Сканировать товар</button><div class="pick-label-progress"><b>Маркировка</b><span>${n(lp.labels)} / ${n(lp.required)}</span></div></div></div>`;
  panel.querySelector('[data-pick-action="scan"]')?.addEventListener('click',()=>scanProduct(shipment,boxes));
  panel.querySelector('[data-pick-action="label"]')?.addEventListener('click',async()=>{try{await DB.put('fbs',beginLabeling(shipment));await render()}catch(e){alert(e.message)}});
  panel.querySelector('[data-pick-action="ship"]')?.addEventListener('click',async()=>{try{await DB.put('fbs',shipShipment(shipment));await render()}catch(e){alert(e.message)}});
  panel.querySelectorAll('[data-pick-box]').forEach(x=>x.addEventListener('click',()=>{selectedBoxId=x.dataset.pickBox;render()}));
  if(shipment.status==='labeling'){
    const action=document.createElement('button');action.className='btn secondary';action.textContent='Сканировать WB-стикер';action.onclick=async()=>{const labels=shipment.labels||[];const variant=shipment.items.find(i=>Number(i.quantity)>labels.filter(l=>l.variantId===i.variantId).length);if(!variant){alert('Все товары промаркированы.');return}const code=prompt(`WB-стикер для ${variant.article||variant.variantId}:`);if(!code)return;try{const next=addLabel(shipment,variant.variantId,code);await DB.put('fbs',getLabelProgress(next).complete?readyShipment(next):next);await render()}catch(e){alert(e.message)}};panel.querySelector('.fbs-picking-actions').appendChild(action);
  }
}
function addNavButton(){if(document.querySelector('[data-fbs-picking-nav]'))return;const nav=document.querySelector('#mainNav');if(!nav)return;const b=document.createElement('button');b.textContent='Сборка поставки';b.dataset.fbsPickingNav='1';b.className='fbs-picking-nav';b.addEventListener('click',async()=>{shipmentId=null;selectedBoxId=null;const view=document.querySelector('#view');if(view)view.innerHTML='';await createShipmentFromOrders()});nav.appendChild(b)}
function watch(){addNavButton();if(!started){started=true;setTimeout(()=>{const rows=DB.all('fbs');},0)}}
setTimeout(watch,100);setInterval(watch,1000);
