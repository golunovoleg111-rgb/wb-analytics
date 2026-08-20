import {createWarehouse,addWall,addZone,addEntrance,addFeature,removeWall,removeFeature,addBox,setBoxContents,moveBox,removeBox,lockBox,warehouseInventory,scanBox} from './fbsWarehouseV2.js';

export const DESIGN_TOOLS = Object.freeze(['select','wall','rect','partition','window','route','entrance','erase']);
export const DESIGN_LABELS = Object.freeze({select:'Выбор',wall:'Стена',rect:'Прямоугольник',partition:'Перегородка',window:'Окно',route:'Маршрут',entrance:'Вход / выход',erase:'Ластик'});
export const createFbsWarehouseState = name => ({...createWarehouse(name), designLocked:false});
export const canEditLayout = w => !w.designLocked;
export const finishLayout = w => { w.designLocked=true; w.updatedAt=new Date().toISOString(); return w };
export const reopenLayout = w => { w.designLocked=false; w.updatedAt=new Date().toISOString(); return w };
export const removeZone = (w,id) => {
  const zones=Array.isArray(w.zones)?w.zones:[];
  const boxes=Array.isArray(w.boxes)?w.boxes:[];
  const z=zones.find(x=>x.id===id);
  if(!z) throw Error('Зона не найдена');
  const boxIds=new Set(Array.isArray(z.boxIds)?z.boxIds:[]);
  for(const box of boxes) if(box?.zoneId===id) boxIds.add(box.id);
  for(const box of boxes) if(boxIds.has(box.id)) box.zoneId=null;
  w.zones=zones.filter(x=>x.id!==id);
  w.updatedAt=new Date().toISOString();
  return w;
};
export const sortInventory = rows => [...rows].sort((a,b)=>String(a.article||a.name||'').localeCompare(String(b.article||b.name||''),'ru',{numeric:true,sensitivity:'base'}));
export {addWall,addZone,addEntrance,addFeature,removeWall,removeFeature,addBox,setBoxContents,moveBox,removeBox,lockBox,warehouseInventory,scanBox};
