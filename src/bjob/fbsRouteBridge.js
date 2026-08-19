let installed=false;
let modulePromise=null;
function loadScreen(){if(!modulePromise)modulePromise=import('./fbsWarehouseScreen.js');return modulePromise}
export function installFbsRouteBridge(){
  if(installed)return;
  installed=true;
  const mount=()=>{
    const view=document.querySelector('#view');
    if(!view)return;
    const open=()=>{localStorage.setItem('bjob:route','fbs');loadScreen().then(m=>m.mountFbsWarehouseScreen(view)).catch(err=>{console.error('B-JOB FBS screen failed',err);view.innerHTML=`<section class="page"><div class="empty-panel"><h1>Склад FBS</h1><p>Не удалось загрузить модуль склада.</p><small>${String(err?.message||err)}</small></div></section>`})};
    if(localStorage.getItem('bjob:route')==='fbs')open();
    view.querySelectorAll('[data-route="fbs"]').forEach(el=>{
      if(el.dataset.fbsBridge==='1')return;
      el.dataset.fbsBridge='1';
      el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open()},true);
    });
  };
  const observer=new MutationObserver(()=>mount());
  observer.observe(document.body,{childList:true,subtree:true});
  mount();
  window.addEventListener('bjob:fbs-open',mount);
}
