const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const { createLanServer, localIPv4 } = require('./lanServer');
const { createProtocol } = require('./lanProtocol');

let server;
let serverPort;
let lanServer;
let lanConfig;

function dataDir() { return path.join(app.getPath('userData'), 'data'); }
function appRoot() { return app.isPackaged ? path.join(process.resourcesPath, 'bjob-app') : path.resolve(__dirname, '..'); }
const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.webmanifest':'application/manifest+json' };
function safePath(urlPath) { const root=path.resolve(appRoot()); const target=path.resolve(root, `.${decodeURIComponent(urlPath)}`); return target===root||target.startsWith(root+path.sep)?target:null; }
function localJsonStore(name) { return path.join(dataDir(), `lan-${name}.json`); }
async function readLanStore(name) { const file=localJsonStore(name); if(!fs.existsSync(file))return []; return JSON.parse(fs.readFileSync(file,'utf8')); }
async function writeLanStore(name, rows) { fs.writeFileSync(localJsonStore(name), JSON.stringify(rows ?? [], null, 2), 'utf8'); }
async function clearLanStore(name) { const file=localJsonStore(name); if(fs.existsSync(file))fs.unlinkSync(file); }
const LAN_STORES=['products','stocks','warehouses','fbsSpaces','fbsBoxes','fbsInventory','stockMovements','shipments'];

function startLocalServer() {
  fs.mkdirSync(dataDir(), {recursive:true});
  server=http.createServer((req,res)=>{
    try {
      const requestUrl=new URL(req.url||'/', 'http://127.0.0.1');
      if(requestUrl.pathname==='/api/health'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({ok:true,mode:'desktop-local',version:app.getVersion()}));return;}
      const target=safePath(requestUrl.pathname);
      if(!target){res.writeHead(403);res.end('Forbidden');return;}
      let file=target;
      if(requestUrl.pathname==='/'||!path.extname(target))file=path.join(appRoot(),'index.html');
      if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
      res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
    } catch {res.writeHead(500);res.end('Internal error');}
  });
  server.listen(0,'127.0.0.1',()=>{serverPort=server.address().port;createWindow();});
}

function createWindow(){
  const win=new BrowserWindow({width:1440,height:900,minWidth:1100,minHeight:700,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});
  win.loadURL(`http://127.0.0.1:${serverPort}/`);
}

async function lanRequest(baseUrl, token, pathName, options={}) {
  const response=await fetch(`${baseUrl.replace(/\/$/,'')}${pathName}`,{...options,headers:{...(options.headers||{}),'X-BJOB-LAN-Token':token,'Content-Type':'application/json'}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`LAN request failed: ${response.status}`);
  return data;
}
async function lanPushSnapshot(baseUrl,token,snapshot){
  const names=Object.keys(snapshot||{}).filter(name=>LAN_STORES.includes(name));
  for(const name of names)await lanRequest(baseUrl,token,'/lan/store',{method:'POST',body:JSON.stringify({name,rows:snapshot[name]||[]})});
  return {ok:true,stores:names};
}
async function lanPullSnapshot(baseUrl,token){
  const hello=await lanRequest(baseUrl,token,'/lan/hello');
  const stores={};
  for(const name of (hello.stores||[]))stores[name]=(await lanRequest(baseUrl,token,`/lan/store?name=${encodeURIComponent(name)}`)).rows||[];
  return {ok:true,data:stores};
}

ipcMain.handle('desktop-info',()=>({version:app.getVersion(),dataDir:dataDir(),port:serverPort,root:appRoot(),lan:lanConfig}));
ipcMain.handle('desktop-export-json',async(_event,payload)=>{
  const result=await dialog.showSaveDialog({title:'Экспорт базы B-JOB',defaultPath:`BJOB-backup-${new Date().toISOString().slice(0,10)}.json`,filters:[{name:'B-JOB backup',extensions:['json']}]});
  if(result.canceled||!result.filePath)return {cancelled:true};
  fs.writeFileSync(result.filePath,JSON.stringify({format:'bjob-json',version:1,createdAt:new Date().toISOString(),data:payload},null,2),'utf8');
  return {cancelled:false,filePath:result.filePath};
});
ipcMain.handle('desktop-import-json',async()=>{
  const result=await dialog.showOpenDialog({title:'Импорт базы B-JOB',properties:['openFile'],filters:[{name:'B-JOB backup',extensions:['json']}]});
  if(result.canceled||!result.filePaths[0])return {cancelled:true};
  const raw=JSON.parse(fs.readFileSync(result.filePaths[0],'utf8'));
  if(!raw||raw.format!=='bjob-json'||!raw.data||typeof raw.data!=='object')throw new Error('Неверный файл базы B-JOB');
  return {cancelled:false,filePath:result.filePaths[0],data:raw.data};
});
ipcMain.handle('lan-start',async()=>{
  if(lanServer)return lanConfig;
  const token=crypto.randomBytes(24).toString('hex');
  const protocol=createProtocol({stores:LAN_STORES,readStore:readLanStore,writeStore:writeLanStore,clearStore:clearLanStore});
  const result=await createLanServer({port:8787,token,onRequest:protocol});
  lanServer=result.server;
  lanConfig={enabled:true,address:result.address,port:result.port,token:result.token,url:`http://${result.address}:${result.port}`};
  return lanConfig;
});
ipcMain.handle('lan-stop',async()=>{if(lanServer){await new Promise(resolve=>lanServer.close(resolve));lanServer=null;}lanConfig=null;return {enabled:false};});
ipcMain.handle('lan-status',()=>lanConfig||{enabled:false,address:localIPv4()});
ipcMain.handle('lan-push',async(_event,{baseUrl,token,snapshot})=>lanPushSnapshot(baseUrl,token,snapshot));
ipcMain.handle('lan-pull',async(_event,{baseUrl,token})=>lanPullSnapshot(baseUrl,token));

app.whenReady().then(()=>{startLocalServer();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on('window-all-closed',()=>{if(server)server.close();if(lanServer)lanServer.close();if(process.platform!=='darwin')app.quit();});
