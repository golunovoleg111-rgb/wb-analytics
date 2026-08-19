import { mountFbsWarehouseScreen } from './fbsWarehouseScreen.js';

export function installFbsRouteBridge(){
  const mount=()=>{
    const view=document.querySelector('#view');
    if(!view)return;
    if(localStorage.getItem('bjob:route')==='fbs')mountFbsWarehouseScreen(view);
    view.querySelectorAll('[data-route="fbs"]').forEach(el=>{
      if(el.dataset.fbsBridge==='1')return;
      el.dataset.fbsBridge='1';
      el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();localStorage.setItem('bjob:route','fbs');mountFbsWarehouseScreen(view)},true);
    });
  };
  const observer=new MutationObserver(mount);
  observer.observe(document.body,{childList:true,subtree:true});
  mount();
  window.addEventListener('bjob:fbs-open',mount);
}
