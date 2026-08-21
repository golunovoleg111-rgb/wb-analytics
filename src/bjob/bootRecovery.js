(() => {
  const SAFE='bjob:safe-mode';
  const started=Date.now();
  let ready=false;
  const show=(title,message)=>{const app=document.querySelector('#app');if(app)app.innerHTML=`<div class="single-fatal"><h1>${title}</h1><p>${message}</p><small>Boot recovery: ${Date.now()-started} ms</small></div>`};
  window.addEventListener('bjob:ready',()=>{ready=true},{once:true});
  const recover=(reason)=>{
    if(ready||sessionStorage.getItem(SAFE)==='1')return;
    sessionStorage.setItem(SAFE,'1');
    try{localStorage.removeItem('bjob:route')}catch{}
    try{navigator.serviceWorker?.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).catch(()=>{})}catch{}
    try{window.caches?.keys().then(keys=>Promise.all(keys.map(k=>window.caches.delete(k))).catch(()=>{}))}catch{}
    show('B-JOB — безопасный режим','Обнаружена ошибка запуска. Перезагрузка отключена, чтобы не зациклить неисправный boot. Обновите страницу вручную после устранения причины.');
  };
  window.addEventListener('error',e=>{if(Date.now()-started<30000)recover(e.error||e.message)},{capture:true});
  window.addEventListener('unhandledrejection',e=>{if(Date.now()-started<30000)recover(e.reason)},{capture:true});
  setTimeout(()=>{if(!ready&&!sessionStorage.getItem(SAFE)&&document.querySelector('#app')?.textContent?.includes('B-JOB загружается'))recover('Тайм-аут запуска')},10000);
})();
