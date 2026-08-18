import * as DB from '../db.js';

const now=()=>new Date().toISOString();
const id=p=>`${p}-${crypto.randomUUID()}`;

export async function createWarehouse({name,type='FBS',address='',layout={rows:6,columns:8,cells:[]}}){
  const warehouse={id:id('wh'),name:String(name||'').trim(),type:String(type).toUpperCase(),address:String(address||'').trim(),layout:{rows:Math.max(1,Number(layout.rows||6)),columns:Math.max(1,Number(layout.columns||8)),cells:Array.isArray(layout.cells)?layout.cells:[]},createdAt:now(),updatedAt:now()};
  if(!warehouse.name)throw new Error('Укажите название склада.');
  await DB.put('warehouses',warehouse);return warehouse;
}

export async function updateWarehouseLayout(warehouseId,layout){
  const warehouse=await DB.get('warehouses',warehouseId);if(!warehouse)throw new Error('Склад не найден.');
  const next={...warehouse,layout:{rows:Math.max(1,Number(layout?.rows||warehouse.layout?.rows||1)),columns:Math.max(1,Number(layout?.columns||warehouse.layout?.columns||1)),cells:Array.isArray(layout?.cells)?layout.cells:(warehouse.layout?.cells||[])},updatedAt:now()};
  await DB.put('warehouses',next);return next;
}

export async function createStorageCell({warehouseId,code,x=0,y=0,width=1,height=1,zone='',label=''}){
  const warehouse=await DB.get('warehouses',warehouseId);if(!warehouse)throw new Error('Склад не найден.');
  const cells=Array.isArray(warehouse.layout?.cells)?warehouse.layout.cells:[];
  const cell={id:id('cell'),code:String(code||'').trim(),x:Number(x),y:Number(y),width:Math.max(1,Number(width)),height:Math.max(1,Number(height)),zone:String(zone||'').trim(),label:String(label||code||'').trim()};
  if(!cell.code)throw new Error('Укажите адрес ячейки.');
  if(cells.some(c=>String(c.code).toUpperCase()===cell.code.toUpperCase()))throw new Error('Такая ячейка уже существует.');
  const next={...warehouse,layout:{...(warehouse.layout||{}),cells:[...cells,cell]},updatedAt:now()};await DB.put('warehouses',next);return cell;
}

export async function createBox({warehouseId,cellId=null,code,kind='mono',barcode,locked=false}){
  const warehouse=await DB.get('warehouses',warehouseId);if(!warehouse)throw new Error('Склад не найден.');
  const box={id:id('box'),warehouseId,cellId,code:String(code||'').trim()||id('BOX'),barcode:String(barcode||code||'').trim(),kind:String(kind).toLowerCase()==='mix'?'mix':'mono',locked:!!locked,createdAt:now(),updatedAt:now()};
  if(!box.barcode)throw new Error('Укажите QR/barcode короба.');
  await DB.put('fbsBoxes',box);return box;
}

export async function setBoxLocked(boxId,locked,reason=''){
  const box=await DB.get('fbsBoxes',boxId);if(!box)throw new Error('Короб не найден.');
  const next={...box,locked:!!locked,lockReason:String(reason||''),lockedAt:locked?now():null,updatedAt:now()};await DB.put('fbsBoxes',next);return next;
}

export async function putIntoBox({boxId,variantId,article='',name='',color='',size='',quantity=0}){
  const box=await DB.get('fbsBoxes',boxId);if(!box)throw new Error('Короб не найден.');if(box.locked)throw new Error('Короб заблокирован.');
  const qty=Math.floor(Number(quantity));if(qty<=0)throw new Error('Количество должно быть больше нуля.');
  const rows=await DB.all('fbsInventory');const existing=rows.find(r=>r.boxId===boxId&&r.variantId===variantId&&r.color===color&&r.size===size);
  const row={id:existing?.id||id('inv'),boxId,warehouseId:box.warehouseId,cellId:box.cellId,variantId:String(variantId||article),article:String(article||variantId||''),name:String(name||''),color:String(color||''),size:String(size||''),quantity:Number(existing?.quantity||0)+qty,updatedAt:now()};
  await DB.put('fbsInventory',row);await DB.put('stockMovements',{id:id('move'),type:'put',sourceId:boxId,boxId,variantId:row.variantId,quantity:qty,date:now(),reason:'storage-in'});return row;
}

export async function takeFromBox({boxId,variantId,quantity,assemblyTaskId=null,reason='assembly'}){
  const box=await DB.get('fbsBoxes',boxId);if(!box)throw new Error('Короб не найден.');if(box.locked)throw new Error('Короб заблокирован. Изъятие запрещено.');
  const qty=Math.floor(Number(quantity));if(qty<=0)throw new Error('Количество должно быть больше нуля.');
  const rows=await DB.all('fbsInventory');const row=rows.find(r=>r.boxId===boxId&&r.variantId===variantId&&Number(r.quantity)>0);if(!row)throw new Error('Изделие не найдено в этом коробе.');if(Number(row.quantity)<qty)throw new Error(`В коробе доступно только ${row.quantity} шт.`);
  const remaining=Number(row.quantity)-qty;await DB.put('fbsInventory',{...row,quantity:remaining,updatedAt:now()});
  await DB.put('stockMovements',{id:id('move'),type:'take',sourceId:boxId,boxId,variantId,quantity:-qty,assemblyTaskId,date:now(),reason});
  if(assemblyTaskId){const task=await DB.get('assemblyTasks',assemblyTaskId);if(task){const items=Array.isArray(task.items)?task.items:[];const nextItems=items.map(item=>item.variantId===variantId?{...item,picked:Number(item.picked||0)+qty}:item);const complete=nextItems.every(item=>Number(item.picked||0)>=Number(item.quantity||0));await DB.put('assemblyTasks',{...task,items:nextItems,status:complete?'assembled':'in_progress',updatedAt:now()});await DB.put('assemblyEvents',{id:id('assembly-event'),taskId:assemblyTaskId,type:'pick',boxId,cellId:box.cellId,variantId,quantity:qty,date:now()})}}
  return {...row,quantity:remaining,taken:qty,boxId,cellId:box.cellId};
}

export async function getStorageOverview(warehouseId){
  const boxes=(await DB.all('fbsBoxes')).filter(b=>b.warehouseId===warehouseId);const inventory=(await DB.all('fbsInventory')).filter(r=>r.warehouseId===warehouseId);const quantities=inventory.reduce((sum,r)=>sum+Number(r.quantity||0),0);return {warehouseId,boxes:boxes.length,monoBoxes:boxes.filter(b=>b.kind==='mono').length,mixBoxes:boxes.filter(b=>b.kind==='mix').length,items:quantities,lockedBoxes:boxes.filter(b=>b.locked).length,inventory};
}

export async function buildAssemblyRoadmap(taskId){
  const task=await DB.get('assemblyTasks',taskId);if(!task)throw new Error('Сборочное задание не найдено.');const requested=Array.isArray(task.items)?task.items:[];const boxes=await DB.all('fbsBoxes');const inventory=await DB.all('fbsInventory');const roadmap=[];
  for(const item of requested){let need=Math.max(0,Number(item.quantity||0)-Number(item.picked||0));if(!need)continue;const candidates=inventory.filter(r=>r.variantId===item.variantId&&Number(r.quantity)>0).sort((a,b)=>String(a.cellId||'').localeCompare(String(b.cellId||'')));for(const stock of candidates){if(!need)break;const box=boxes.find(b=>b.id===stock.boxId);if(!box||box.locked)continue;const take=Math.min(need,Number(stock.quantity));roadmap.push({step:roadmap.length+1,warehouseId:stock.warehouseId,cellId:stock.cellId,boxId:stock.boxId,boxCode:box.code,variantId:item.variantId,quantity:take});need-=take}if(need>0)roadmap.push({step:roadmap.length+1,variantId:item.variantId,quantity:need,unavailable:true})}
  const next={...task,roadmap,status:roadmap.some(x=>x.unavailable)?'blocked':'roadmap_ready',updatedAt:now()};await DB.put('assemblyTasks',next);return roadmap;
}
