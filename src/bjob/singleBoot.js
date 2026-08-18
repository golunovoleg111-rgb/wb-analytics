import * as Core from './core/runtime.js';
import { ensureCore, session, login, completeFirstLogin } from './userAuth.js';
import { start } from './singleApp.js';

function loginScreen(first=false){
  const root=document.createElement('div');
  root.className='single-login';
  root.innerHTML=`<div class="single-login-card"><div class="single-logo">B-JOB</div><h1>${first?'Создайте пароль':'Вход'}</h1><p>${first?'Установите постоянный пароль администратора.':'Войдите в локальное рабочее пространство.'}</p><form>${first?'': '<label>Логин<input name="login" autocomplete="username" required></label>'}<label>${first?'Новый пароль':'Пароль'}<input name="password" type="password" autocomplete="${first?'new-password':'current-password'}" minlength="${first?8:1}" required></label>${first?'<label>Повторите пароль<input name="repeat" type="password" minlength="8" required></label>':''}<div class="single-login-error"></div><button type="submit">${first?'Сохранить пароль':'Войти'}</button></form></div>`;
  document.body.appendChild(root);
  return root;
}
async function authenticate(){
  if(!session()){
    const root=loginScreen(false);
    await new Promise(resolve=>root.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;try{const user=await login(f.login.value,f.password.value);if(!user)throw new Error('Неверный логин или пароль.');root.remove();resolve()}catch(err){root.querySelector('.single-login-error').textContent=err.message}}));
  }
  const current=session();
  if(current?.mustChangePassword){
    const root=loginScreen(true);
    await new Promise(resolve=>root.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;try{if(f.password.value!==f.repeat.value)throw new Error('Пароли не совпадают.');await completeFirstLogin(f.password.value);root.remove();resolve()}catch(err){root.querySelector('.single-login-error').textContent=err.message}}));
  }
}
async function boot(){
  await Core.boot();
  await ensureCore();
  await authenticate();
  if(!session())throw new Error('Сессия не создана.');
  await start();
  window.dispatchEvent(new CustomEvent('bjob:ready'));
}
boot().catch(error=>{console.error('B-JOB startup failed',error);const app=document.querySelector('#app');if(app)app.innerHTML=`<div class="single-fatal"><h1>B-JOB не запущен</h1><p>${String(error?.message||error)}</p><button onclick="location.reload()">Повторить</button></div>`});
