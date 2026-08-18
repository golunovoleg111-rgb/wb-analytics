import * as Core from './core/runtime.js';
import { ensureCore, session, login, logout, completeFirstLogin } from './userAuth.js';
import { start } from './singleAppStep1.js';
import * as WarehouseCore from './warehouseCore.js';
import * as BackupCore from './backupCore.js';
import { initPr49Ui } from './pr49UiBridge.js';

const LOCAL_SESSION='bjob:desktop:session';
function restoreSession(){try{if(!session()){const raw=localStorage.getItem(LOCAL_SESSION);if(raw)sessionStorage.setItem('bjob:v2:user',raw)}}catch(e){console.warn('B-JOB session restore',e)}}
function persistSession(){try{const current=session();if(current)localStorage.setItem(LOCAL_SESSION,JSON.stringify(current))}catch(e){console.warn('B-JOB session persist',e)}}
function loginScreen(first=false){
  const root=document.createElement('div');root.className='single-login';
  root.innerHTML=`<div class="single-login-card"><div class="single-logo">B-JOB</div><h1>${first?'Создайте пароль':'Вход'}</h1><p>${first?'Установите постоянный пароль администратора.':'Войдите в локальное рабочее пространство.'}</p><form>${first?'':'<label>Логин<input name="login" autocomplete="username" required></label>'}<label>${first?'Новый пароль':'Пароль'}<input name="password" type="password" autocomplete="${first?'new-password':'current-password'}" minlength="${first?8:1}" required></label>${first?'<label>Повторите пароль<input name="repeat" type="password" minlength="8" required></label>':''}<div class="single-login-error"></div><button type="submit">${first?'Сохранить пароль':'Войти'}</button></form></div>`;
  document.body.appendChild(root);return root;
}
async function authenticate(){
  restoreSession();
  if(!session()){
    const root=loginScreen(false);
    await new Promise(resolve=>root.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;try{const user=await login(f.login.value,f.password.value);if(!user)throw new Error('Неверный логин или пароль.');persistSession();root.remove();resolve()}catch(err){root.querySelector('.single-login-error').textContent=err.message}}));
  }
  const current=session();
  if(current?.mustChangePassword){
    const root=loginScreen(true);
    await new Promise(resolve=>root.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;try{if(f.password.value!==f.repeat.value)throw new Error('Пароли не совпадают.');await completeFirstLogin(f.password.value);persistSession();root.remove();resolve()}catch(err){root.querySelector('.single-login-error').textContent=err.message}}));
  }
}
async function boot(){
  initPr49Ui();
  await Core.boot();await ensureCore();await authenticate();if(!session())throw new Error('Сессия не создана.');
  window.BJobWarehouse=WarehouseCore;
  window.BJobBackup=BackupCore;
  window.bjobDesktop=window.BJobDesktop||null;
  await start();window.dispatchEvent(new CustomEvent('bjob:ready'));
}
boot().catch(error=>{console.error('B-JOB startup failed',error);const app=document.querySelector('#app');if(app)app.innerHTML=`<div class="single-fatal"><h1>B-JOB не запущен</h1><p>${String(error?.message||error)}</p><button onclick="location.reload()">Повторить</button></div>`});
