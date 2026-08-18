import {login,session,logout,completeFirstLogin} from './userAuth.js';

const OPTIONAL_MODULES=[
  './ui/projectHardening.js','./ui/keyboardShortcuts.js','./ui/formGuards.js','./ui/loadingState.js','./ui/actionFeedback.js','./ui/performanceHelpers.js','./ui/tableUtils.js','./ui/virtualList.js',
  './data/sharedDataBridge.js','./bjob/appExperience.js','./bjob/uiEnhancements.js','./bjob/dashboardExperience.js','./bjob/fbsWorkspaceUI.js','./bjob/fbsPickingUI.js','./bjob/fbsExperience.js','./bjob/fbsFixes.js','./bjob/fbsOperationsUI.js','./bjob/fbsQrExperience.js','./bjob/fbsQrFullscreenFix.js','./bjob/fbsStorageUI.js'
];

function style(){
  if(document.getElementById('bjob-clean-boot-css')) return;
  const s=document.createElement('style'); s.id='bjob-clean-boot-css';
  s.textContent=`.bjob-clean-login{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#0d0f13;color:#f5f6f8;font-family:Inter,system-ui,sans-serif}.bjob-clean-card{width:min(440px,calc(100vw - 32px));padding:30px;border:1px solid #2b3038;border-radius:22px;background:#15181e;box-shadow:0 30px 80px #0008}.bjob-clean-card h1{margin:0 0 8px}.bjob-clean-card p{color:#aeb5c0}.bjob-clean-card label{display:block;margin:14px 0 6px;color:#cbd1da}.bjob-clean-card input{width:100%;box-sizing:border-box;padding:13px;border:1px solid #343b46;border-radius:10px;background:#0f1217;color:#fff}.bjob-clean-card button{width:100%;margin-top:18px;padding:13px;border:0;border-radius:10px;background:#fff;color:#111;font-weight:700;cursor:pointer}.bjob-clean-error{min-height:20px;color:#ff7c7c;margin-top:10px}.bjob-clean-status{position:fixed;left:18px;bottom:18px;z-index:8000;padding:8px 11px;border:1px solid #e2e4e8;border-radius:9px;background:#fff;color:#555;font:12px system-ui;box-shadow:0 5px 18px #1111}`;
  document.head.appendChild(s);
}

function overlay(title,description,first=false){
  const root=document.createElement('div'); root.className='bjob-clean-login';
  root.innerHTML=`<div class="bjob-clean-card"><small>B-JOB · ${first?'ПЕРВЫЙ ВХОД':'ОРГАНИЗАЦИЯ'}</small><h1>${title}</h1><p>${description}</p><form><label>${first?'Новый пароль':'Логин'}<input name="value" type="${first?'password':'text'}" autocomplete="${first?'new-password':'username'}" minlength="${first?8:1}" required></label>${first?'<label>Повторите пароль<input name="repeat" type="password" autocomplete="new-password" minlength="8" required></label>':'<label>Пароль<input name="password" type="password" autocomplete="current-password" required></label>'}<div class="bjob-clean-error"></div><button>${first?'Сохранить пароль':'Войти'}</button></form></div>`;
  document.body.appendChild(root); return root;
}

async function authenticate(){
  if(!session()){
    const root=overlay('Вход в систему','Введите персональные данные сотрудника.');
    await new Promise(resolve=>root.querySelector('form').addEventListener('submit',async e=>{
      e.preventDefault(); const f=e.target;
      try{const u=await login(f.value.value,f.password.value); if(!u) throw new Error('Неверный логин, пароль или пользователь заблокирован.'); root.remove(); window.dispatchEvent(new CustomEvent('bjob:auth-ready')); resolve();}
      catch(err){root.querySelector('.bjob-clean-error').textContent=err.message;}
    }));
  }
  const current=session();
  if(current?.mustChangePassword){
    const root=overlay('Создайте постоянный пароль','Одноразовый пароль больше не будет использоваться после подтверждения.',true);
    await new Promise(resolve=>root.querySelector('form').addEventListener('submit',async e=>{
      e.preventDefault(); const f=e.target;
      if(f.value.value!==f.repeat.value){root.querySelector('.bjob-clean-error').textContent='Пароли не совпадают.';return;}
      try{await completeFirstLogin(f.value.value);root.remove();window.dispatchEvent(new CustomEvent('bjob:auth-ready'));resolve();}
      catch(err){root.querySelector('.bjob-clean-error').textContent=err.message;}
    }));
  }
}

async function loadOptional(){
  const results=await Promise.allSettled(OPTIONAL_MODULES.map(path=>import(path)));
  const failed=results.map((r,i)=>r.status==='rejected'?OPTIONAL_MODULES[i]:null).filter(Boolean);
  if(failed.length) console.warn('B-JOB optional modules skipped:',failed);
}

function status(){
  const old=document.querySelector('.bjob-clean-status'); if(old)old.remove();
  if(!session())return;
  const el=document.createElement('div');el.className='bjob-clean-status';el.textContent='Локальная база · автономный режим';document.body.appendChild(el);
}

async function boot(){
  style();
  await authenticate();
  if(!session())return;
  // Core first. A failure here is fatal; optional enhancements never block startup.
  await import('./app.js');
  await import('./navigationV2.js');
  await import('./adminV2Fixed.js');
  await loadOptional();
  status();
  window.dispatchEvent(new CustomEvent('bjob:ready'));
}

boot().catch(err=>{
  console.error('B-JOB core boot failed',err);
  const main=document.querySelector('#app main');
  if(main) main.innerHTML='<section class="bjob-empty"><h2>Не удалось запустить B-JOB</h2><p>Ошибка загрузки ядра. Локальная база не изменена.</p><button class="btn primary" onclick="location.reload()">Повторить</button></section>';
});

window.BJobLogout=()=>{logout();location.reload()};
