const clean=v=>String(v??'').trim();
const positive=(v,label='Количество')=>{const n=Number(v);if(!Number.isFinite(n)||n<=0)throw new Error(`${label} должно быть больше нуля.`);return n};
const now=()=>new Date().toISOString();

export const PICKING_STATUS=['new','picking','packed','labeling','ready','shipped','cancelled'];

export function createFbsShipment({id,number='',warehouse='',items=[],status='new'}={}){
  if(!clean(id))throw new Error('Для поставки нужен идентификатор.');
  const normalized=items.map(x=>({variantId:clean(x.variantId||x.id||x.barcode),article:clean(x.article),size:clean(x.size),color:clean(x.color),barcode:clean(x.barcode),quantity:positive(x.quantity)}));
  if(!normalized.length)throw new Error('Поставка должна содержать товары.');
  return {id,number:clean(number)||id,warehouse:clean(warehouse),items:normalized,status,scanned:[],labels:[],createdAt:now(),updatedAt:now()};
}

export function getPickingProgress(shipment){
  const required=shipment.items.reduce((s,x)=>s+Number(x.quantity||0),0);
  const scanned=(shipment.scanned||[]).reduce((s,x)=>s+Number(x.quantity||0),0);
  return {required,scanned,remaining:Math.max(0,required-scanned),percent:required?Math.min(100,scanned/required*100):0,complete:required>0&&scanned>=required};
}

export function scanShipmentItem(shipment,item,{boxId='',barcode=''}={}){
  if(!['new','picking'].includes(shipment.status))throw new Error('Поставка сейчас не принимает товары.');
  const key=clean(item.variantId||item.id||item.barcode||barcode);
  const target=shipment.items.find(x=>x.variantId===key||x.barcode===barcode);
  if(!target)throw new Error('Отсканированный товар отсутствует в этой поставке.');
  const already=(shipment.scanned||[]).filter(x=>x.variantId===target.variantId).reduce((s,x)=>s+Number(x.quantity||0),0);
  if(already>=target.quantity)throw new Error(`Товар ${target.article||target.variantId} уже собран в нужном количестве.`);
  const next=[...(shipment.scanned||[])];
  const row=next.find(x=>x.variantId===target.variantId&&x.boxId===boxId);
  if(row)row.quantity=Number(row.quantity||0)+1;else next.push({variantId:target.variantId,article:target.article,size:target.size,color:target.color,barcode:target.barcode||barcode,boxId,quantity:1,scannedAt:now()});
  const progress=getPickingProgress({...shipment,scanned:next});
  return {...shipment,scanned:next,status:progress.complete?'packed':'picking',updatedAt:now()};
}

export function beginLabeling(shipment){if(!getPickingProgress(shipment).complete)throw new Error('Нельзя перейти к маркировке: поставка собрана не полностью.');return {...shipment,status:'labeling',updatedAt:now()};}
export function addLabel(shipment,variantId,labelCode){if(shipment.status!=='labeling')throw new Error('Поставка не находится на этапе маркировки.');const key=clean(variantId);const item=shipment.items.find(x=>x.variantId===key);if(!item)throw new Error('Товар отсутствует в поставке.');const already=(shipment.labels||[]).filter(x=>x.variantId===key).length;const required=item.quantity;if(already>=required)throw new Error('Все единицы этого товара уже промаркированы.');return {...shipment,labels:[...(shipment.labels||[]),{variantId:key,labelCode:clean(labelCode),printedAt:now()}],updatedAt:now()};}
export function getLabelProgress(shipment){const required=shipment.items.reduce((s,x)=>s+Number(x.quantity||0),0);const labels=(shipment.labels||[]).length;return {required,labels,remaining:Math.max(0,required-labels),percent:required?Math.min(100,labels/required*100):0,complete:required>0&&labels>=required};}
export function readyShipment(shipment){if(!getLabelProgress(shipment).complete)throw new Error('Нельзя завершить поставку: не все товары промаркированы.');return {...shipment,status:'ready',updatedAt:now()};}
export function shipShipment(shipment){if(shipment.status!=='ready')throw new Error('Поставка не готова к отгрузке.');return {...shipment,status:'shipped',shippedAt:now(),updatedAt:now()};}

export function findBoxItem(box,variantId,barcode=''){return (box.items||[]).find(x=>x.variantId===clean(variantId)||Boolean(barcode)&&x.barcode===barcode);}
export function pickFromBox(box,variantId,quantity=1){const q=positive(quantity);const item=findBoxItem(box,variantId);if(!item)throw new Error('Товар не найден в выбранной коробке.');if(Number(item.quantity)<q)throw new Error(`В коробке только ${item.quantity} шт.`);return {...box,items:box.items.map(x=>x.variantId===item.variantId?{...x,quantity:Number(x.quantity)-q}:x).filter(x=>x.quantity>0),updatedAt:now()};}

export function buildPickPlan(shipment,boxes){const remaining=new Map();for(const x of shipment.items)remaining.set(x.variantId,Number(x.quantity));return boxes.filter(b=>b.status!=='disabled').map(box=>{const take=[];for(const item of box.items||[]){const need=remaining.get(item.variantId)||0;if(need>0){const quantity=Math.min(need,Number(item.quantity||0));if(quantity){take.push({...item,quantity});remaining.set(item.variantId,need-quantity)}}}return take.length?{boxId:box.id,coordinates:box.coordinates,items:take}:null}).filter(Boolean).sort((a,b)=>Number(b.coordinates.level)-Number(a.coordinates.level));}
