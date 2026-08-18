import { createShop, createUser, createWorkspace, setActiveShop, setActiveWorkspace, setActive, listUsers } from './userAuth.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=()=>document.querySelector('#single-view');
function modalShell(title,body,buttons='<button type="button" data-pr49-close>Закрыть</button>'){let host=document.querySelector('#pr49-modal');if(!host){host=document.createElement('div');host.id='pr49-modal';document.body.appendChild(host)}host.innerHTML=`<div class="modal-bg"><div class="modal pr49-modal"><button type="button" class="close" data-pr49-close>×</button><h2>${esc(title)}</h2>${body}<div>${buttons}</div></div></div>`;host.querySelectorAll('[data-pr49-close]').forEach(x=>x.addEventListener('click',()=>host.remove()));return host}
const showError=message=>modalShell('Ошибка',`<p class="pr49-error">${esc(message)}</p>`);
const showForm=(title,fields,submit)=>{const host=modalShell(title,`<form id="pr49-form">${fields.map(f=>`<label>${esc(f.label)}<input name="${esc(f.name)}" type="${f.type||'text'}" ${f.required?'required':''} value="${esc(f.value||'')}"></label>`).join('')}<p class="pr49-error"></p><div><button type="button" data-pr49-close>Отмена</button><button>Сохранить</button></div></form>`, '');host.querySelector('#pr49-form').onsubmit=async e=>{e.preventDefault();try{await submit(Object.fromEntries(new FormData(e.currentTarget)));if(document.querySelector('#pr49-modal')===host)host.remove();window.dispatchEvent(new CustomEvent('bjob:refresh'))}catch(err){e.currentTarget.querySelector('.pr49-error').textContent=err.message}}};

function bind(){
 document.addEventListener('click',async e=>{
   const close=e.target.closest('[data-pr49-close]');if(close){document.querySelector('#pr49-modal')?.remove();return}
   const a=e.target.closest('[data-action]');if(!a)return;const action=a.dataset.action;
   if(!['add-shop','add-workspace','add-user','choose-shop','choose-workspace','toggle-user','backup-restore'].includes(action))return;
   e.preventDefault();e.stopImmediatePropagation();
   try{
    if(action==='add-shop')return showForm('Добавить магазин',[{name:'name',label:'Название',required:true},{name:'marketplace',label:'Маркетплейс (WB/Ozon)',required:true}],v=>createShop(v));
    if(action==='add-workspace')return showForm('Создать рабочее пространство',[{name:'name',label:'Название',required:true},{name:'description',label:'Описание'}],v=>createWorkspace(v));
    if(action==='add-user')return showForm('Добавить сотрудника',[{name:'login',label:'Логин',required:true},{name:'name',label:'Имя',required:true},{name:'role',label:'Роль',value:'warehouse'},{name:'temporaryPassword',label:'Одноразовый пароль (необязательно)'}],async v=>{const result=await createUser(v);document.querySelector('#pr49-modal')?.remove();modalShell('Сотрудник создан',`<p>Логин: <b>${esc(result.login)}</b></p><p>Одноразовый пароль:</p><p class="pr49-password"><b>${esc(result.temporaryPassword)}</b></p><p>Пароль сохраняется в карточке сотрудника до первого входа.`);return result});
    if(action==='choose-shop'){await setActiveShop(a.dataset.id);return window.dispatchEvent(new CustomEvent('bjob:refresh'))}
    if(action==='choose-workspace'){await setActiveWorkspace(a.dataset.id);return window.dispatchEvent(new CustomEvent('bjob:refresh'))}
    if(action==='toggle-user'){const users=await listUsers(),u=users.find(x=>x.id===a.dataset.id);if(u)await setActive(u.id,u.active===false);return window.dispatchEvent(new CustomEvent('bjob:refresh'))}
    if(action==='backup-restore'){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{if(!input.files[0])return;try{const result=await window.BJobBackup.readBackupFile(input.files[0]);modalShell('Backup восстановлен',`<p>Восстановлено записей: <b>${result.restored}</b></p><p>Приложение сейчас перезапустит интерфейс.</p>`,'<button type="button" data-pr49-reload>Перезапустить</button>');document.querySelector('[data-pr49-reload]')?.addEventListener('click',()=>location.reload())}catch(err){showError(err.message)}};input.click()}
   }catch(err){showError(err.message)}
 },true);
 const observer=new MutationObserver(()=>injectBackupControl());observer.observe(document.body,{childList:true,subtree:true});injectBackupControl();
}
function injectBackupControl(){const view=root();if(!view||document.querySelector('[data-action="backup-restore"]'))return;if(/Резервные копии/.test(view.textContent||'')){const target=view.querySelector('.single-actions');if(target){const b=document.createElement('button');b.dataset.action='backup-restore';b.textContent='Восстановить JSON backup';target.appendChild(b)}}}
export function initPr49Ui(){bind()}
