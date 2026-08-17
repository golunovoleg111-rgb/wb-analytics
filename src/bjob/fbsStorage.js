import * as DB from '../db.js';

export const STORES={inventory:'fbsInventory',boxes:'fbsBoxes',movements:'fbsMovements'};
const id=prefix=>`${prefix}_${crypto.randomUUID()}`;
const now=()=>new Date().toISOString();
const num=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;

export async function listInventory(){return DB.all(STORES.inventory)}
export async function listBoxes(){return DB.all(STORES.boxes)}
export async function listMovements(){return DB.all(STORES.movements)}
export async function addInventory({article,name='',size='',color='',quantity=0}={}){if(!String(article||'').trim())throw new Error('Укажите артикул.');const row={id:id('inv'),article:String(article).trim(),name:String(name||'').trim(),size:String(size||'').trim(),color:String(color||'').trim(),quantity:num(quantity),createdAt:now(),updatedAt:now()};await DB.put(STORES.inventory,row);return row}
export async function updateInventory(row){const next={...row,quantity:num(row.quantity),updatedAt:now()};await DB.put(STORES.inventory,next);return next}
export async function removeInventory(inventoryId){const row=await DB.get?.(STORES.inventory,inventoryId);if(row)await DB.delete(STORES.inventory,inventoryId);}
export async function addBox({spaceId,article,inventoryId='',quantity=0,coordinates={},qrCode='',label=''}={}){if(!spaceId||!article)throw new Error('Коробка должна быть связана с пространством и артикулом.');const box={id:id('box'),spaceId,article:String(article).trim(),inventoryId,quantity:num(quantity),coordinates,qrCode:String(qrCode||id('qr')).trim(),label:String(label||'').trim(),status:'active',createdAt:now(),updatedAt:now()};await DB.put(STORES.boxes,box);await recordMovement({type:'box_create',article,quantity:box.quantity,boxId:box.id});return box}
export async function updateBox(box){const next={...box,quantity:Math.max(0,num(box.quantity)),updatedAt:now()};await DB.put(STORES.boxes,next);return next}
export async function removeBox(boxId){await DB.delete(STORES.boxes,boxId);await recordMovement({type:'box_delete',boxId,quantity:0});}
export async function scanBox(qrCode){const code=String(qrCode||'').trim();const boxes=await listBoxes();const box=boxes.find(x=>x.qrCode===code||x.id===code);if(!box)throw new Error('Коробка с таким QR-кодом не найдена.');return box}
export async function decrementBox(boxId,quantity=1,meta={}){const q=num(quantity);if(q<=0)throw new Error('Количество должно быть больше нуля.');const box=(await listBoxes()).find(x=>x.id===boxId);if(!box)throw new Error('Коробка не найдена.');if(num(box.quantity)<q)throw new Error(`В коробке осталось ${num(box.quantity)} шт.`);const next={...box,quantity:num(box.quantity)-q,updatedAt:now()};await DB.put(STORES.boxes,next);const inv=(await listInventory()).find(x=>x.id===box.inventoryId||x.article===box.article);if(inv){inv.quantity=Math.max(0,num(inv.quantity)-q);inv.updatedAt=now();await DB.put(STORES.inventory,inv)}await recordMovement({type:'scan_decrement',article:box.article,boxId,quantity:-q,...meta});return next}
export async function recordMovement(data){await DB.put(STORES.movements,{id:id('mov'),...data,createdAt:now()})}
export async function getInventoryReport(){const [inventory,boxes,movements]=await Promise.all([listInventory(),listBoxes(),listMovements()]);return inventory.map(row=>{const own=boxes.filter(b=>b.inventoryId===row.id||b.article===row.article);const boxed=own.reduce((s,b)=>s+num(b.quantity),0);const sold=movesForArticle(movements,row.article).reduce((s,m)=>s+Math.max(0,-num(m.quantity)),0);return {...row,boxed,unboxed:Math.max(0,num(row.quantity)-boxed),sold}})}
function movesForArticle(movements,article){return movements.filter(m=>m.article===article)}
export async function exportFbs(){const [inventory,boxes,movements]=await Promise.all([listInventory(),listBoxes(),listMovements()]);return {version:1,exportedAt:now(),inventory,boxes,movements}}
export async function importFbs(payload){if(!payload||payload.version!==1)throw new Error('Неподдерживаемый формат FBS JSON.');for(const row of payload.inventory||[])await DB.put(STORES.inventory,row);for(const row of payload.boxes||[])await DB.put(STORES.boxes,row);for(const row of payload.movements||[])await DB.put(STORES.movements,row);return {inventory:(payload.inventory||[]).length,boxes:(payload.boxes||[]).length,movements:(payload.movements||[]).length}}
