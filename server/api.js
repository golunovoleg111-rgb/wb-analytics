import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const serverDir=path.dirname(fileURLToPath(import.meta.url));
const publicRoot=path.resolve(serverDir,'..');
const dataDir=path.join(serverDir,'data');
const dbFile=path.join(dataDir,'shared.json');
const stores=['products','sales','stocks','ads','expenses','fbs','settings','imports','warehouses','warehouseMoves','pallets','boxes','shipments','productionOrders','apiConnections','users','audit','fbsSpaces','fbsBoxes','stockMovements'];
const empty=()=>Object.fromEntries(stores.map(k=>[k,{}]));
async function readDb(){try{return JSON.parse(await fs.readFile(dbFile,'utf8'))}catch{return empty()}}
let queue=Promise.resolve();
function writeDb(db){queue=queue.then(async()=>{await fs.mkdir(dataDir,{recursive:true});const tmp=dbFile+'.tmp';await fs.writeFile(tmp,JSON.stringify(db,null,2),'utf8');await fs.rename(tmp,dbFile)});return queue}
function json(res,status,payload){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'});res.end(JSON.stringify(payload))}
function readBody(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>5_000_000)req.destroy()});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch(e){reject(e)}});req.on('error',reject)})}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
async function staticFile(req,res){const pathname=new URL(req.url,'http://bjob').pathname;const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');const file=path.resolve(publicRoot,relative);if(!file.startsWith(publicRoot+path.sep))return false;try{const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-cache'});res.end(body);return true}catch{return false}}
const server=http.createServer(async(req,res)=>{try{if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':'Content-Type'});return res.end()}if(req.method==='GET'&&req.url==='/api/health')return json(res,200,{ok:true,service:'bjob-api',time:new Date().toISOString()});const m=req.url?.match(/^\/api\/([^/?]+)$/);if(!m&&req.method==='GET'&&await staticFile(req,res))return;if(!m)return json(res,404,{error:'NOT_FOUND'});const store=decodeURIComponent(m[1]);if(!stores.includes(store))return json(res,404,{error:'UNKNOWN_STORE'});const db=await readDb();if(req.method==='GET')return json(res,200,Object.values(db[store]||{}));if(req.method==='DELETE'){db[store]={};await writeDb(db);return json(res,200,{ok:true,cleared:store})}if(req.method!=='POST')return json(res,405,{error:'METHOD_NOT_ALLOWED'});const mutation=await readBody(req);const id=String(mutation.payload?.id??mutation.id??crypto.randomUUID());const now=new Date().toISOString();db[store]??={};if(mutation.operation==='delete')delete db[store][id];else db[store][id]={...(db[store][id]||{}),...(mutation.payload||{}),id,updatedAt:now};db.audit??={};const auditId=String(mutation.id??crypto.randomUUID());db.audit[auditId]={id:auditId,store,operation:mutation.operation||'upsert',recordId:id,userId:mutation.userId??null,clientId:mutation.clientId??null,createdAt:now};await writeDb(db);return json(res,200,{ok:true,record:db[store][id]??null,serverTime:now})}catch(e){return json(res,500,{error:'SERVER_ERROR',message:String(e?.message||e)})}});
const port=Number(process.env.PORT||8787);server.listen(port,()=>console.log(`B-JOB API listening on ${port}`));
