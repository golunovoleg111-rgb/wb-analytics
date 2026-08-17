import {session,listUsers} from './userAuth.js';

function addSystemControls(){
  const nav=document.querySelector('#mainNav');
  if(!nav||nav.querySelector('[data-v2-system]'))return;
  const r=session();
  const group=[...nav.querySelectorAll('.bjob-group')].find(x=>/Система|Управление/.test(x.textContent||''));
  if(!group)return;
  const btn=document.createElement('button');btn.dataset.v2System='profile';btn.textContent='Мой профиль';btn.className='v2-system-btn';
  btn.onclick=()=>{const u=session();alert(`Пользователь: ${u?.name||u?.login}\nЛогин: ${u?.login||'—'}\nРоль: ${u?.role||'—'}\nОрганизация: ${u?.organizationId||'default'}`)};group.appendChild(btn);
  if(r?.role==='admin'){const users=document.createElement('button');users.dataset.v2System='users';users.textContent=`Пользователи (${listUsers().then(x=>x.filter(u=>u.active!==false).length).catch(()=>0)})`;users.className='v2-system-btn';users.onclick=()=>document.querySelector('[data-v1="users"]')?.click();group.appendChild(users)}
}
export function installPhaseB(){addSystemControls();new MutationObserver(addSystemControls).observe(document.body,{subtree:true,childList:true});}
