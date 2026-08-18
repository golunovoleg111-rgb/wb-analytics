const DB_NAME='beltanee-production';
const DB_VERSION=11;
const STORES=['products','sales','stocks','ads','expenses','fbs','settings','imports','warehouses','warehouseMoves','pallets','boxes','shipments','productionOrders','apiConnections','users','audit','fbsSpaces','fbsBoxes','stockMovements','fbsInventory','fbsInventoryMovements','shops','invitations','authEvents','workspaces'];
const SHOP_SCOPED_STORES=new Set(['products','sales','stocks','ads','expenses','fbs','imports','warehouses','warehouseMoves','pallets','boxes','shipments','productionOrders','fbsSpaces','fbsBoxes','stockMovements','fbsInventory','fbsInventoryMovements','apiConnections']);
const LOCAL_ONLY_STORES=new Set(['apiConnections','users','shops','invitations','authEvents','workspaces']);
function activeShopId(){try{return localStorage.getItem('bjob:v2:active-shop')||null}catch{return null}}
function scopeRows(name,rows){if(!SHOP_SCOPED_STORES.has(name))return rows;const shop=activeShopId();if(!shop)return rows;return rows.filter(row=>!row.shopId||row.shopId===shop)}
function stampRows(name,rows){if(!SHOP_SCOPED_STORES.has(name))return rows;const shop=activeShopId();if(!shop)return rows;return rows.map(row=>row.shopId?row:{...row,shopId:shop})}
function open(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const name of STORES){
        if(db.objectStoreNames.contains(name))continue;
        const store=db.createObjectStore(name,{keyPath:'id',autoIncrement:true});
        if(['products','sales','stocks','ads','fbs','fbsBoxes','stockMovements','fbsInventory'].includes(name))store.createIndex('article','article',{unique:false});
        if(['sales','stocks','ads','fbs','imports','warehouseMoves','shipments','productionOrders','audit','stockMovements','fbsInventoryMovements','authEvents'].includes(name))store.createIndex('date','date',{unique:false});
        if(name==='warehouses')store.createIndex('name','name',{unique:false});
        if(name==='apiConnections')store.createIndex('marketplace','marketplace',{unique:false});
        if(name==='fbsBoxes'){store.createIndex('spaceId','spaceId',{unique:false});store.createIndex('barcode','barcode',{unique:false})}
        if(name==='stockMovements'){store.createIndex('variantId','variantId',{unique:false});store.createIndex('sourceId','sourceId',{unique:false})}
        if(name==='fbsInventory'){store.createIndex('variantId','variantId',{unique:false});store.createIndex('boxId','boxId',{unique:false});store.createIndex('barcode','barcode',{unique:false})}
        if(name==='shops')store.createIndex('marketplace','marketplace',{unique:false});
        if(name==='users'){store.createIndex('login','login',{unique:false});store.createIndex('organizationId','organizationId',{unique:false})}
        if(name==='workspaces'){store.createIndex('organizationId','organizationId',{unique:false});store.createIndex('name','name',{unique:false})}
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('IndexedDB open failed'));
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
export async function reset(){for(const name of STORES)await clearStore(name);try{localStorage.removeItem('bjob:v2:active-shop');localStorage.removeItem('bjob:organization')}catch{}try{sessionStorage.removeItem('bjob:v2:user')}catch{}return true}
export function isLocalFirst(){return true}
export {DB_NAME,DB_VERSION,STORES,SHOP_SCOPED_STORES,LOCAL_ONLY_STORES};