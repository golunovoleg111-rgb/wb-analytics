export const FBS_LOCATION_TYPES=['row','position','level'];
export const FBS_BOX_STATUS=['active','empty','reserved','picking','blocked','disabled'];

const now=()=>new Date().toISOString();
const clean=v=>String(v??'').trim();
const positive=(v,label)=>{const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error(`${label} должно быть неотрицательным числом.`);return n;};

export function createFbsSpace({id,name,address='',rows=1,positionsPerRow=1,maxLevels=6}={}){
  if(!clean(id)||!clean(name))throw new Error('Для пространства FBS нужны идентификатор и название.');
  const r=positive(rows,'Количество рядов'); const p=positive(positionsPerRow,'Количество позиций'); const l=positive(maxLevels,'Количество уровней');
  if(!r||!p||!l)throw new Error('Размеры пространства FBS должны быть больше нуля.');
  return {id,name:clean(name),address:clean(address),rows:r,positionsPerRow:p,maxLevels:l,status:'active',createdAt:now(),updatedAt:now()};
}
export function createFbsBox({id,spaceId,row,position,level,name='',capacity=0,items=[],status='active',barcode=''}={}){
  if(!clean(id)||!clean(spaceId))throw new Error('Для коробки нужны идентификатор и пространство FBS.');
  const coordinates={row:positive(row,'Ряд'),position:positive(position,'Позиция'),level:positive(level,'Уровень')};
  if(!coordinates.row||!coordinates.position||!coordinates.level)throw new Error('Координаты коробки должны начинаться с 1.');
  return {id,spaceId,coordinates,name:clean(name)||`FBS-${coordinates.row}-${coordinates.position}-${coordinates.level}`,barcode:clean(barcode),capacity:positive(capacity,'Вместимость'),items:normalizeItems(items),status,createdAt:now(),updatedAt:now()};
}
export function normalizeItems(items=[]){
  if(!Array.isArray(items))throw new Error('Состав коробки должен быть массивом.');
  return items.map(item=>({variantId:clean(item.variantId||item.id),article:clean(item.article),size:clean(item.size),color:clean(item.color),barcode:clean(item.barcode),quantity:positive(item.quantity,'Количество')})).filter(item=>item.variantId&&item.quantity>0);
}
export function boxCoordinateKey({spaceId,row,position,level}){return `${spaceId}:${Number(row)}:${Number(position)}:${Number(level)}`;}
export function getBoxCoordinateKey(box){return boxCoordinateKey({spaceId:box.spaceId,row:box.coordinates?.row,position:box.coordinates?.position,level:box.coordinates?.level});}
export function validateBoxPlacement(box,space,boxes=[]){
  if(!space||box.spaceId!==space.id)throw new Error('Коробка принадлежит другому пространству.');
  const {row,position,level}=box.coordinates||{};
  if(row<1||row>space.rows||position<1||position>space.positionsPerRow||level<1||level>space.maxLevels)throw new Error('Коробка выходит за границы пространства.');
  const collision=boxes.find(x=>x.id!==box.id&&x.spaceId===box.spaceId&&getBoxCoordinateKey(x)===getBoxCoordinateKey(box));
  if(collision)throw new Error(`Место уже занято коробкой ${collision.name||collision.id}.`); return true;
}
export function getBlockingBoxes(box,boxes=[]){const {row,position,level}=box.coordinates||{};return boxes.filter(x=>x.id!==box.id&&x.spaceId===box.spaceId&&x.coordinates?.row===row&&x.coordinates?.position===position&&Number(x.coordinates?.level)>Number(level)&&x.status!=='disabled').sort((a,b)=>Number(a.coordinates.level)-Number(b.coordinates.level));}
export function isBoxAccessible(box,boxes=[]){return box.status!=='disabled'&&getBlockingBoxes(box,boxes).length===0;}
export function withAccessibility(box,boxes=[]){const blockers=getBlockingBoxes(box,boxes);return {...box,accessible:box.status!=='disabled'&&blockers.length===0,blockedBy:blockers.map(x=>x.id)};}
export function moveFbsBox(box,{row,position,level}={},space,boxes=[]){const moved={...box,coordinates:{row:Number(row),position:Number(position),level:Number(level)},updatedAt:now()};validateBoxPlacement(moved,space,boxes);return moved;}
export function addToFbsBox(box,item,quantity=1){const q=positive(quantity,'Количество');if(!q)throw new Error('Количество должно быть больше нуля.');const current=box.items.reduce((sum,x)=>sum+Number(x.quantity||0),0);if(box.capacity&&current+q>box.capacity)throw new Error(`В коробке недостаточно места. Свободно: ${box.capacity-current}.`);const key=clean(item.variantId||item.id||item.barcode||item.article);if(!key)throw new Error('У товара нет идентификатора варианта.');const items=box.items.map(x=>x.variantId===key?{...x,quantity:Number(x.quantity||0)+q}:x);if(!items.some(x=>x.variantId===key))items.push({...item,variantId:key,quantity:q});return {...box,items,updatedAt:now()};}
export function removeFromFbsBox(box,variantId,quantity=1){const q=positive(quantity,'Количество');const key=clean(variantId);const existing=box.items.find(x=>x.variantId===key);if(!existing)throw new Error('В коробке нет этого варианта товара.');if(Number(existing.quantity)<q)throw new Error(`В коробке осталось только ${existing.quantity} шт.`);return {...box,items:box.items.map(x=>x.variantId===key?{...x,quantity:Number(x.quantity)-q}:x).filter(x=>x.quantity>0),updatedAt:now()};}
export function reserveForPicking(box,variantId,quantity=1){const q=positive(quantity,'Количество');const item=box.items.find(x=>x.variantId===clean(variantId));if(!item||Number(item.quantity)<q)throw new Error('Недостаточно товара в коробке для резервирования.');return {...box,status:'picking',updatedAt:now()};}
export function getBoxStock(box){return box.items.reduce((sum,item)=>sum+Number(item.quantity||0),0);}
export function getBoxFillPercent(box){return box.capacity?Math.min(100,getBoxStock(box)/box.capacity*100):0;}
export function getSpaceStats(space,boxes=[]){const own=boxes.filter(x=>x.spaceId===space.id&&x.status!=='disabled');return {boxes:own.length,stock:own.reduce((sum,x)=>sum+getBoxStock(x),0),capacity:own.reduce((sum,x)=>sum+Number(x.capacity||0),0),accessible:own.filter(x=>isBoxAccessible(x,own)).length,blocked:own.filter(x=>!isBoxAccessible(x,own)).length};}
export function buildPickingRoute(items=[],boxes=[]){const required=new Map(items.map(x=>[clean(x.variantId||x.id||x.barcode),Number(x.quantity||0)]));return boxes.map(box=>{const matches=box.items.filter(item=>required.get(item.variantId)>0);return {...box,required:matches.map(item=>({variantId:item.variantId,quantity:Math.min(item.quantity,required.get(item.variantId))})),accessible:isBoxAccessible(box,boxes)};}).filter(x=>x.required.length).sort((a,b)=>Number(b.coordinates?.level)-Number(a.coordinates?.level));}
