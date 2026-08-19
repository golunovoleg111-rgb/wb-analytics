const KEY='bjob:fbs:v2';
export const loadFbs=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}};
export const saveFbs=w=>{localStorage.setItem(KEY,JSON.stringify(w));return w};
export const clearFbs=()=>localStorage.removeItem(KEY);
export const fbsStatus=()=>navigator.onLine?'ONLINE':'OFFLINE';
export function exportFbs(){const w=loadFbs();if(!w)throw Error('Нет данных склада');return JSON.stringify({format:'BJOB-FBS-V2',exportedAt:new Date().toISOString(),warehouse:w},null,2)}
export function importFbs(text){const p=JSON.parse(text);const w=p?.warehouse||p;if(!w||w.version!==2||!Array.isArray(w.zones)||!Array.isArray(w.boxes))throw Error('Неверный формат B-JOB FBS');saveFbs(w);return w}
