(() => {
  const FLAG='bjob:boot-recovery-attempted';
  const started=Date.now();
  let ready=false;
  window.addEventListener('bjob:ready',()=>{ready=true;sessionStorage.removeItem(FLAG)},{once:true});
  const recover=(reason)=>{
    if(ready||sessionStorage.getItem(FLAG)==='1')return;
    if(!document.querySelector('#app'))return;
    sessionStorage.setItem(FLAG,'1');
    try{localStorage.removeItem('bjob:route')}catch{}
    try{navigator.serviceWorker?.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).catch(()=>{})}catch{}
    try{caches?.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).catch(()=>{})}catch{}
    const app=document.querySelector('#app');
    if(app)app.innerHTML='<div class="single-fatal"><h1>B-JOB восстанавливается</h1><p>Обнаружена ошибка запуска. Кэш и последний маршрут очищаются.</p><small>'+String(reason?.message||reason||'Неизвестная ошибка')+'</small></div>';
    setTimeout(()=>location.reload(),250);
  };
  window.addEventListener('error',e=>{if(Date.now()-started<30000)recover(e.error||e.message)},{capture:true});
  window.addEventListener('unhandledrejection',e=>{if(Date.now()-started<30000)recover(e.reason)},{capture:true});
  setTimeout(()=>{if(!ready&&document.querySelector('#app')?.textContent?.includes('B-JOB загружается'))recover('Тайм-аут запуска')},10000);
})();
