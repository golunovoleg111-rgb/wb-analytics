import {createWarehouse,addWall,addZone,addEntrance,addFeature,removeWall,removeFeature,addBox,setBoxContents,moveBox,removeBox,lockBox,warehouseInventory,scanBox} from './fbsWarehouseV2.js';

export const DESIGN_TOOLS = Object.freeze(['select','wall','rect','partition','window','route','entrance','erase']);
export const DESIGN_LABELS = Object.freeze({select:'Выбор',wall:'Стена',rect:'Прямоугольник',partition:'Перегородка',window:'Окно',route:'Маршрут',entrance:'Вход / выход',erase:'Ластик'});
export const createFbsWarehouseState = name => ({...createWarehouse(name),designLocked:false});
export const canEditLayout = w => !w.designLocked;
export const finishLayout = w => {w.designLocked=true;w.updatedAt=new Date().toISOString();return w};
export const reopenLayout = w => {w.designLocked=false;w.updatedAt=new Date().toISOString();return w};
export const normalizeWarehouse = w => {
  if(!w||typeof w!=='object')throw Error('Некорректные данные склада');
  w.walls=Array.isArray(w.walls)?w.walls:[];
  w.zones=Array.isArray(w.zones)?w.zones:[];
  w.entrances=Array.isArray(w.entrances)?w.entrances:[];
  w.features=Array.isArray(w.features)?w.features:[];
  w.boxes=Array.isArray(w.boxes)?w.boxes:[];
  w.assemblyTasks=Array.isArray(w.assemblyTasks)?w.assemblyTasks:[];
  if(!w.canvas||typeof w.canvas!=='object')w.canvas={width:1600,height:1000};
  if(typeof w.designLocked!=='boolean')w.designLocked=false;
  for(const z of w.zones){z.boxIds=Array.isArray(z.boxIds)?z.boxIds:[];}
  for(const b of w.boxes){if(!('zoneId' in b))b.zoneId=null;}
  return w;
};
export const removeZone = (w,id) => {
  normalizeWarehouse(w);
  const z=w.zones.find(x=>x.id===id);
  if(!z)throw Error('Зона не найдена');
  const boxIds=new Set(z.boxIds);
  for(const b of w.boxes){if(b.zoneId===id||boxIds.has(b.id))b.zoneId=null;}
  w.zones=w.zones.filter(x=>x.id!==id);
  w.updatedAt=new Date().toISOString();
  return w;
};
export const sortInventory = rows => [...(Array.isArray(rows)?rows:[])].sort((a,b)=>String(a.article||a.name||'').localeCompare(String(b.article||b.name||''),'ru',{numeric:true,sensitivity:'base'}));
export {addWall,addZone,addEntrance,addFeature,removeWall,removeFeature,addBox,setBoxContents,moveBox,removeBox,lockBox,warehouseInventory,scanBox};
