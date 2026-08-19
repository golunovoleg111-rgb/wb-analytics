import * as DB from '../db.js';

const uid = (p='id') => `${p}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();

/** Local-first FBS operations. The module is deliberately independent from UI so the .exe can run without API/LAN. */
export async function getFbsTasks(shopId=null){
  const rows = await DB.all('productionOrders');
  return rows.filter(r => !shopId || !r.shopId || r.shopId === shopId);
}

export async function buildRoadmap(taskId){
  const task = (await DB.all('productionOrders')).find(x => x.id === taskId);
  if(!task) throw new Error('Сборочное задание не найдено');
  const items = task.items || [];
  const boxes = await DB.all('boxes');
  const roadmap=[];
  for(const item of items){
    let need = Number(item.quantity || 0);
    for(const box of boxes){
      if(box.blocked || need <= 0) continue;
      const content=(box.contents||[]).find(x => x.productId === item.productId || x.article === item.article);
      if(!content || Number(content.quantity||0)<=0) continue;
      const take=Math.min(need, Number(content.quantity));
      roadmap.push({id:uid('roadmap'),taskId,boxId:box.id,locationId:box.locationId||null,productId:item.productId||null,article:item.article||null,quantity:take,status:'pending'});
      need-=take;
    }
    if(need>0) roadmap.push({id:uid('roadmap'),taskId,boxId:null,locationId:null,productId:item.productId||null,article:item.article||null,quantity:need,status:'missing'});
  }
  for(const row of roadmap) await DB.put('roadmaps',row);
  await DB.put('productionOrders',{...task,roadmapId:task.roadmapId||taskId,status:'roadmap_ready',updatedAt:now()});
  return roadmap;
}

export async function takeFromBox({taskId, roadmapId, boxId, quantity=1}){
  const qty=Math.max(1,Number(quantity));
  const box=(await DB.all('boxes')).find(x=>x.id===boxId);
  if(!box) throw new Error('Короб не найден');
  if(box.blocked) throw new Error('Короб заблокирован');
  const row=(await DB.all('roadmaps')).find(x=>x.id===roadmapId && x.taskId===taskId && x.boxId===boxId);
  if(!row) throw new Error('Товар не предусмотрен этим ROADMAP');
  if(qty>Number(row.quantity)) throw new Error('Нельзя взять больше, чем указано в ROADMAP');
  const contents=(box.contents||[]).map(x=>({...x}));
  const index=contents.findIndex(x=>x.productId===row.productId || x.article===row.article);
  if(index<0 || Number(contents[index].quantity||0)<qty) throw new Error('Недостаточный остаток в коробе');
  contents[index].quantity-=qty;
  await DB.put('boxes',{...box,contents,updatedAt:now()});
  await DB.put('roadmaps',{...row,quantity:row.quantity-qty,status:row.quantity-qty===0?'done':'in_progress'});
  await DB.put('warehouseMoves',{id:uid('move'),type:'fbs_pick',taskId,roadmapId,boxId,productId:row.productId||null,article:row.article||null,quantity:-qty,date:now()});
  return {boxId,quantity:qty,remaining:row.quantity-qty};
}

export async function getWarehouseMode(){
  const mode=localStorage.getItem('bjob:connection-mode')||'OFFLINE';
  return {mode,updatedAt:localStorage.getItem('bjob:connection-updated')||null};
}

export async function setWarehouseMode(mode){
  if(!['API','LAN','OFFLINE'].includes(mode)) throw new Error('Неизвестный режим');
  localStorage.setItem('bjob:connection-mode',mode); localStorage.setItem('bjob:connection-updated',now());
  return getWarehouseMode();
}
