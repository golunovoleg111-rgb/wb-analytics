let installed=false;
let modulePromise=null;
let opening=false;
function loadScreen(){if(!modulePromise)modulePromise=import('./fbsWarehouseScreen.js');return modulePromise}
function showError(view,err){console.error('B-JOB FBS screen failed',err);view.innerHTML=`<section class="page"><div class="empty-panel"><h1>Склад FBS</h1><p>Не удалось загрузить модуль склада.</p><small>${String(err?.message||err)}</small></div></section>`}
function openFbs(){
  const view=document.querySelector('#view');
  if(!view||opening)return;
  opening=true;
  localStorage.setItem('bjob:route','fbs');
  loadScreen().then(m=>m.mountFbsWarehouseScreen(view)).catch(err=>showError(view,err)).finally(()=>{opening=false});
}
export function installFbsRouteBridge(){
  if(installed)return;
  installed=true;
  document.addEventListener('click',e=>{
    const target=e.target?.closest?.('[data-route="fbs"]');
    if(!target)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openFbs();
  },true);
  if(localStorage.getItem('bjob:route')==='fbs')openFbs();
}
