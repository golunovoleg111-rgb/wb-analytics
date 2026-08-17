const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { URL } = require('url');

let server;
let serverPort;

function dataDir() {
  return path.join(app.getPath('userData'), 'data');
}

function appRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'bjob-app');
  return path.resolve(__dirname, '..');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

function safePath(urlPath) {
  const root = path.resolve(appRoot());
  const target = path.resolve(root, `.${decodeURIComponent(urlPath)}`);
  return target === root || target.startsWith(root + path.sep) ? target : null;
}

function startLocalServer() {
  fs.mkdirSync(dataDir(), { recursive: true });
  server = http.createServer((req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
      if (requestUrl.pathname === '/api/health') {
        res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({ ok: true, mode: 'desktop-local', version: app.getVersion() }));
        return;
      }
      let target = safePath(requestUrl.pathname);
      if (!target) { res.writeHead(403); res.end('Forbidden'); return; }
      if (requestUrl.pathname === '/' || !path.extname(target)) target = path.join(appRoot(), 'index.html');
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, {'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache'});
      fs.createReadStream(target).pipe(res);
    } catch (error) {
      res.writeHead(500); res.end('Internal error');
    }
  });
  server.listen(0, '127.0.0.1', () => { serverPort = server.address().port; createWindow(); });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadURL(`http://127.0.0.1:${serverPort}/`);
}

ipcMain.handle('desktop-info', () => ({ version: app.getVersion(), dataDir: dataDir(), port: serverPort, root: appRoot() }));

app.whenReady().then(() => {
  startLocalServer();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (server) server.close(); if (process.platform !== 'darwin') app.quit(); });
