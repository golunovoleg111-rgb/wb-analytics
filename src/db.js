const DB_NAME='beltanee-production';
const DB_VERSION=13;
const STORES=['products','sales','stocks','ads','expenses','fbs','settings','imports','warehouses','warehouseMoves','pallets','boxes','shipments','productionOrders','apiConnections','users','audit','fbsSpaces','fbsBoxes','stockMovements','fbsInventory','fbsInventoryMovements','shops','invitations','authEvents','workspaces','orders','assemblyTasks','assemblyEvents'];
const SHOP_SCOPED_STORES=new Set(['products','sales','stocks','ads','expenses','fbs','imports','warehouses','warehouseMoves','pallets','boxes','shipments','productionOrders','fbsSpaces','fbsBoxes','stockMovements','fbsInventory','fbsInventoryMovements','apiConnections','orders','assemblyTasks','assemblyEvents']);
const LOCAL_ONLY_STORES=new Set(['apiConnections','users','shops','invitations','authEvents','workspaces']);
let dbPromise=null;
function activeShopId(){try{return localStorage.getItem('bjob:v2:active-shop')||null}catch{return null}}
function scopeRows(name,rows){if(!SHOP_SCOPED_STORES.has(name))return rows;const shop=activeShopId();if(!shop)return rows;return rows.filter(row=>row.shopId===shop)}
function stampRows(name,rows){if(!SHOP_SCOPED_STORES.has(name))return rows;const shop=activeShopId();if(!shop)return rows;return rows.map(row=>row.shopId?row:{...row,shopId:shop})}
function open(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    let settled=false;
    const fail=error=>{if(settled)return;settled=true;dbPromise=null;reject(error)};
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    const timer=setTimeout(()=>fail(new Error('IndexedDB не отвечает. Возможно, база занята другой вкладкой. Закройте другие вкладки B-JOB и обновите страницу.')),8000);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const name of STORES){
        if(db.objectStoreNames.contains(name))continue;
        const store=db.createObjectStore(name,{keyPath:'id',autoIncrement:true});
        if(['products','sales','stocks','ads','fbs','fbsBoxes','stockMovements','fbsInventory','orders','assemblyTasks'].includes(name))store.createIndex('article','article',{unique:false});
        if(['sales','stocks','ads','fbs','imports','warehouseMoves','shipments','productionOrders','audit','stockMovements','fbsInventoryMovements','authEvents','orders','assemblyTasks','assemblyEvents'].includes(name))store.createIndex('date','date',{unique:false});
        if(name==='warehouses')store.createIndex('name','name',{unique:false});
        if(name==='apiConnections')store.createIndex('marketplace','marketplace',{unique:false});
        if(name==='fbsBoxes'){store.createIndex('spaceId','spaceId',{unique:false});store.createIndex('barcode','barcode',{unique:false})}
        if(name==='stockMovements'){store.createIndex('variantId','variantId',{unique:false});store.createIndex('sourceId','sourceId',{unique:false})}
        if(name==='fbsInventory'){store.createIndex('variantId','variantId',{unique:false});store.createIndex('boxId','boxId',{unique:false});store.createIndex('barcode','barcode',{unique:false})}
        if(name==='shops')store.createIndex('marketplace','marketplace',{unique:false});
        if(name==='users'){store.createIndex('login','login',{unique:false});store.createIndex('organizationId','organizationId',{unique:false})}
        if(name==='workspaces'){store.createIndex('organizationId','organizationId',{unique:false});store.createIndex('name','name',{unique:false})}
        if(name==='orders')store.createIndex('orderNumber','orderNumber',{unique:false});
        if(name==='assemblyTasks')store.createIndex('status','status',{unique:false});
        if(name==='assemblyEvents')store.createIndex('taskId','taskId',{unique:false});
      }
    };
    request.onsuccess=()=>{if(settled)return;settled=true;clearTimeout(timer);resolve(request.result)};
    request.onerror=()=>{clearTimeout(timer);fail(request.error||new Error('IndexedDB open failed'))};
    request.onblocked=()=>fail(new Error('IndexedDB заблокирован другой вкладкой B-JOB. Закройте остальные вкладки приложения и обновите страницу.'));
  });
  return dbPromise;
}
function tx(name,mode,work){return open().then(db=>new Promise((resolve,reject)=>{let request;let settled=false;let transaction;try{transaction=db.transaction(name,mode);request=work(transaction.objectStore(name))}catch(error){reject(error);return}const finish=()=>{if(!settled){settled=true;resolve(request?.result!==undefined?request.result:request)}};transaction.oncomplete=finish;transaction.onerror=()=>{if(!settled){settled=true;reject(transaction.error||new Error('IndexedDB transaction failed'))}};transaction.onabort=()=>{if(!settled){settled=true;reject(transaction.error||new Error('IndexedDB transaction aborted'))}};if(request&&typeof request.onsuccess!=='undefined'){request.onsuccess=finish;request.onerror=()=>{if(!settled){settled=true;reject(request.error||new Error('IndexedDB request failed'))}}}}))}
async function localAll(name){return scopeRows(name,await tx(name,'readonly',store=>store.getAll()))}
async function replaceLocal(name,rows){return open().then(db=>new Promise((resolve,reject)=>{const transaction=db.transaction(name,'readwrite');const store=transaction.objectStore(name);store.clear();for(const row of stampRows(name,rows))store.put(row);transaction.oncomplete=()=>resolve(rows.length);transaction.onerror=()=>reject(transaction.error||new Error('IndexedDB replace failed'));transaction.onabort=()=>reject(transaction.error||new Error('IndexedDB replace aborted'))}))}
export async function clearStore(name){return tx(name,'readwrite',store=>store.clear())}
export async function remove(name,id){return tx(name,'readwrite',store=>store.delete(id))}
export async function get(name,id){return tx(name,'readonly',store=>store.get(id))}
export async function count(name){return (await all(name)).length}
export async function all(name){return localAll(name)}
export async function putMany(name,rows){if(!Array.isArray(rows)||!rows.length)return 0;const stamped=stampRows(name,rows);return open().then(db=>new Promise((resolve,reject)=>{const transaction=db.transaction(name,'readwrite');const store=transaction.objectStore(name);for(const row of stamped)store.put(row);transaction.oncomplete=()=>resolve(stamped.length);transaction.onerror=()=>reject(transaction.error||new Error('IndexedDB write failed'));transaction.onabort=()=>reject(transaction.error||new Error('IndexedDB write aborted'))}))}
export async function put(name,row){return putMany(name,[row])}
export async function replaceMany(name,rows){return replaceLocal(name,Array.isArray(rows)?rows:[])}
export async function snapshot(){const result={};for(const name of STORES)result[name]=await tx(name,'readonly',store=>store.getAll());return result}
export async function assignUnscopedToShop(shopId){if(!shopId)return 0;let changed=0;const db=await open();for(const name of SHOP_SCOPED_STORES){const rows=await new Promise((resolve,reject)=>{const r=db.transaction(name,'readonly').objectStore(name).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});const legacy=rows.filter(row=>!row.shopId);if(!legacy.length)continue;await new Promise((resolve,reject)=>{const t=db.transaction(name,'readwrite'),s=t.objectStore(name);for(const row of legacy)s.put({...row,shopId});t.oncomplete=resolve;t.onerror=()=>reject(t.error||new Error(`Failed to migrate ${name}`));t.onabort=()=>reject(t.error||new Error(`Aborted migrating ${name}`))});changed+=legacy.length}return changed}
export async function restoreSnapshot(snapshot,{clear=true}={}){if(!snapshot||typeof snapshot!=='object')throw new Error('Некорректный backup JSON.');let total=0;for(const name of STORES){if(!Array.isArray(snapshot[name]))continue;if(clear)await clearStore(name);total+=await replaceMany(name,snapshot[name])}return total}
export function isLocalFirst(){return true}
export {DB_NAME,DB_VERSION,STORES,SHOP_SCOPED_STORES,LOCAL_ONLY_STORES};