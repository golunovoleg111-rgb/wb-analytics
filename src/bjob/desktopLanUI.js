import * as DB from '../db.js';

const KEY='bjob:lan-config';
const STORES=['products','stocks','warehouses','fbsSpaces','fbsBoxes','fbsInventory','stockMovements','shipments'];

function desktop(){return globalThis.BJobDesktop&&typeof globalThis.BJobDesktop.lanPush==='function'?globalThis.BJobDesktop:null}
function cfg(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function save(v){localStorage.setItem(KEY,JSON.stringify(v))}
async function snapshot(){const out={};for(const name of STORES)out[name]=await DB.all(name);return out}
async function apply(data){for(const [name,rows] of Object.entries(data||{})){if(!STORES.includes(name)||!Array.isArray(rows))continue;await DB.replaceMany(name,rows)}}

function modal(title,body){const w=document.createElement('div');w.className='v1-modal';w.innerHTML=`<div class="v1-modal-card"><h2>${title}</h2>${body}</div>`;document.body.appendChild(w);w.addEventListener('click',e=>{if(e.target===w)w.remove()});return w}
function addStyle(){if(document.getElementById('bjob-lan-style'))return;const s=document.createElement('style');s.id='bjob-lan-style';s.textContent='.lan-panel{display:grid;gap:12px}.lan-code{padding:12px;border-radius:10px;background:#f1f3f6;font-family:ui-monospace,monospace;word-break:break-all}.lan-actions{display:flex;gap:8px;flex-wrap:wrap}.lan-actions button{padding:10px 14px;border:1px solid #ccd1d8;border-radius:9px;background:#fff;cursor:pointer}.lan-actions .primary{background:#111;color:#fff;border-color:#111}.lan-note{color:#69717d;font-size:13px}';document.head.appendChild(s)}

export function installDesktopLanUI(){
  if(!desktop()||document.querySelector('[data-v1="lan"]'))return;
  addStyle();
  const tools=document.querySelector('.v1-tools');if(!tools)return;
  const b=document.createElement('button');b.dataset.v1='lan';b.textContent='LAN';tools.insertBefore(b,tools.firstChild);
  b.onclick=async()=>{
    const d=desktop();
    const current=cfg();
    let status={enabled:false};try{status=await d.lanStatus()}catch{}
    const w=modal('Локальная сеть',`<div class="lan-panel"><p>Работа между компьютерами в одной Wi‑Fi/LAN сети. Интернет не требуется.</p><div><strong>Этот компьютер</strong><div class="lan-code">${status.enabled?`${status.url}<br>Ключ: ${status.token}`:'LAN-сервер не запущен'}</div></div><div class="lan-actions"><button id="lan-start" class="primary">Запустить LAN-сервер</button><button id="lan-stop">Остановить</button></div><hr><div><strong>Подключение к компьютеру-хосту</strong><label>Адрес<input id="lan-url" value="${current.url||''}" placeholder="http://192.168.1.10:8787"></label><label>Ключ<input id="lan-token" value="${current.token||''}" placeholder="ключ с компьютера-хоста"></label></div><div class="lan-actions"><button id="lan-save">Сохранить подключение</button><button id="lan-push">Отправить локальные данные</button><button id="lan-pull">Получить данные с хоста</button></div><div class="lan-note">Перед синхронизацией сделайте JSON-резервную копию. Получение данных заменяет перечисленные локальные хранилища.</div></div>`);
    const url=w.querySelector('#lan-url'),token=w.querySelector('#lan-token');
    w.querySelector('#lan-start').onclick=async()=>{try{const x=await d.lanStart();alert(`LAN запущен: ${x.url}\nКлюч: ${x.token}`);location.reload()}catch(e){alert(e.message)}};
    w.querySelector('#lan-stop').onclick=async()=>{await d.lanStop();location.reload()};
    w.querySelector('#lan-save').onclick=()=>{save({url:url.value.trim(),token:token.value.trim()});alert('Подключение сохранено.')};
    w.querySelector('#lan-push').onclick=async()=>{try{save({url:url.value.trim(),token:token.value.trim()});const result=await d.lanPush({baseUrl:url.value.trim(),token:token.value.trim(),snapshot:await snapshot()});alert(`Данные отправлены. Хранилищ: ${result.stores.length}.`)}catch(e){alert(`Не удалось отправить данные: ${e.message}`)}};
    w.querySelector('#lan-pull').onclick=async()=>{try{save({url:url.value.trim(),token:token.value.trim()});const result=await d.lanPull({baseUrl:url.value.trim(),token:token.value.trim()});await apply(result.data);alert('Данные получены. Страница будет обновлена.');location.reload()}catch(e){alert(`Не удалось получить данные: ${e.message}`)}};
  };
}
