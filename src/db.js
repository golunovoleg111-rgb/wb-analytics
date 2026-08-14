const DB_NAME='beltanee-production';
const DB_VERSION=4;
const STORES=['products','sales','stocks','ads','expenses','fbs','settings','imports','warehouses','warehouseMoves','pallets','boxes','shipments','productionOrders','apiConnections','users','audit','fbsSpaces','fbsBoxes','stockMovements'];
let dbPromise;
function open(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;for(const s of STORES){if(!db.objectStoreNames.contains(s)){const st=db.createObjectStore(s,{keyPath:'id',autoIncrement:true});if(['products','sales','stocks','ads','fbs','fbsBoxes','stockMovements'].includes(s))st.createIndex('article','article',{unique:false});if(['sales','stocks','ads','fbs','imports','warehouseMoves','shipments','productionOrders','audit','stockMovements'].includes(s))st.createIndex('date','date',{unique:false});if(s==='warehouses')st.createIndex('name','name',{unique:false});if(s==='apiConnections')st.createIndex('marketplace','marketplace',{unique:false});if(s==='fbsBoxes'){st.createIndex('spaceId','spaceId',{unique:false});st.createIndex('barcode','barcode',{unique:false});}if(s==='stockMovements'){st.createIndex('variantId','variantId',{unique:false});st.createIndex('sourceId','sourceId',{unique:false});}}}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return dbPromise}
export async function clearStore(name){const db=await open();return tx(db,name,'readwrite',s=>s.clear())}
export async function count(name){const db=await open();return tx(db,name,'readonly',s=>s.count())}
export async function all(name){const db=await open();return tx(db,name,'readonly',s=>s.getAll())}
export async function putMany(name,rows){if(!rows?.length)return 0;const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction(name,'readwrite'),s=t.objectStore(name);for(const row of rows)s.put(row);t.oncomplete=()=>resolve(rows.length);t.onerror=()=>reject(t.error)})}
export async function put(name,row){return putMany(name,[row])}
export async function replaceMany(name,rows){const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction(name,'readwrite'),s=t.objectStore(name);s.clear();for(const row of rows)s.put(row);t.oncomplete=()=>resolve(rows.length);t.onerror=()=>reject(t.error)})}
function tx(db,name,mode,op){return new Promise((resolve,reject)=>{const t=db.transaction(name,mode),s=t.objectStore(name),r=op(s);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function snapshot(){const out={};for(const s of STORES)out[s]=await all(s);return out}
export async function reset(){for(const s of STORES)await clearStore(s)}
export {DB_NAME,DB_VERSION,STORES};
