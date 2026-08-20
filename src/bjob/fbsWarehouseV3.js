import {createWarehouse,addWall,addZone,addEntrance,addFeature,removeWall,removeFeature,addBox,setBoxContents,moveBox,removeBox,lockBox,warehouseInventory,scanBox} from './fbsWarehouseV2.js';

export const DESIGN_TOOLS = Object.freeze(['select','wall','rect','partition','window','route','entrance','erase']);
export const DESIGN_LABELS = Object.freeze({select:'Выбор',wall:'Стена',rect:'Прямоугольник',partition:'Перегородка',window:'Окно',route:'Маршрут',entrance:'Вход / выход',erase:'Ластик'});
export const createFbsWarehouseState = name => ({...createWarehouse(name),designLocked:false});
export const canEditLayout = w => !w.designLocked;
export const finishLayout = w => {w.designLocked=true;w.updatedAt=new Date().toISOString();return w};
export const reopenLayout = w => {w.designLocked=false;w.updatedAt=new Date().toISOString();return w};
export const removeZone = (w,id) => {const z=w.zones.find(x=>x.id===id);if(!z)throw Error('Зона не найдена');if(z.boxIds.length)throw Error('Нельзя удалить зону, пока в ней есть короба');w.zones=w.zones.filter(x=>x.id!==id);w.updatedAt=new Date().toISOString();return w};
export const sortInventory = rows => [...rows].sort((a,b)=>String(a.article||a.name||'').localeCompare(String(b.article||b.name||''),'ru',{numeric:true,sensitivity:'base'}));
export {addWall,addZone,addEntrance,addFeature,removeWall,removeFeature,addBox,setBoxContents,moveBox,removeBox,lockBox,warehouseInventory,scanBox};
