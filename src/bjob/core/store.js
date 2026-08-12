const KEY='bjob:v1';
const empty=()=>({products:[],sales:[],stocks:[],ads:[],expenses:[],fbs:[],warehouses:[],shipments:[],productionOrders:[],apiConnections:[],imports:[],settings:{}});
export function load(){try{return {...empty(),...(JSON.parse(localStorage.getItem(KEY)||'{}'))};}catch{return empty();}}
export function save(data){localStorage.setItem(KEY,JSON.stringify(data));return data;}
export function all(name){return load()[name]||[];}
export function put(name,value){const d=load();if(!Array.isArray(d[name]))d[name]=[];d[name].push(value);save(d);return value;}
export function replace(name,values){const d=load();d[name]=Array.isArray(values)?values:[];return save(d);}
export function reset(){localStorage.removeItem(KEY);return empty();}
export function settings(values){const d=load();d.settings={...d.settings,...values};return save(d).settings;}
