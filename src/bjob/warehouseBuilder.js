export const CELL_TYPES=['zone','rack','shelf','cell'];
export function createWarehouse(name='Новый склад'){return {id:crypto.randomUUID(),name,cells:[],version:1,updatedAt:new Date().toISOString()};}
export function addCell(warehouse,{type='cell',name='Ячейка',x=0,y=0,w=1,h=1,address=''}={}){const cell={id:crypto.randomUUID(),type,name,x,y,w,h,address,locked:false};warehouse.cells.push(cell);warehouse.updatedAt=new Date().toISOString();warehouse.version++;return cell;}
export function updateCell(warehouse,id,patch={}){const c=warehouse.cells.find(x=>x.id===id);if(!c)throw new Error('Ячейка не найдена');Object.assign(c,patch);warehouse.updatedAt=new Date().toISOString();warehouse.version++;return c;}
export function removeCell(warehouse,id){const i=warehouse.cells.findIndex(x=>x.id===id);if(i<0)throw new Error('Ячейка не найдена');warehouse.cells.splice(i,1);warehouse.updatedAt=new Date().toISOString();warehouse.version++;return true;}
export function moveCell(warehouse,id,x,y){return updateCell(warehouse,id,{x,y});}
export function setCellLock(warehouse,id,locked){return updateCell(warehouse,id,{locked:Boolean(locked)});}
export function warehouseStats(warehouse){return {cells:warehouse.cells.length,locked:warehouse.cells.filter(c=>c.locked).length,types:Object.fromEntries(CELL_TYPES.map(t=>[t,warehouse.cells.filter(c=>c.type===t).length]))};}
