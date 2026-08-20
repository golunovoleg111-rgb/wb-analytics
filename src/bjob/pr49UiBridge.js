import { createShop, createUser, createWorkspace, setActiveShop, setActiveWorkspace, setActive, listUsers } from './userAuth.js';
import { SECTIONS, ACTIONS, roleOptions, roleLabel, normalizeRole, permissionsForRole } from './accessModel.js';

const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const root=()=>document.querySelector('#view,#single-view');
const actionLabels={view:'Просмотр',create:'Создание',edit:'Изменение',delete:'Удаление',import:'Импорт',export:'Экспорт',manage:'Управление'};
const roleValues=roleOptions();

function modalShell(title,body,buttons='<button type="button" class="ui-btn ghost" data-pr49-close>Закрыть</button>'){
  let host=document.querySelector('#pr49-modal');
  if(!host){host=document.createElement('div');host.id='pr49-modal';document.body.appendChild(host)}
  host.innerHTML=`<div class="modal-bg" role="presentation"><div class="modal pr49-modal" role="dialog" aria-modal="true" aria-labelledby="pr49-title"><button type="button" class="close" data-pr49-close aria-label="Закрыть">×</button><h2 id="pr49-title">${esc(title)}</h2>${body}${buttons?`<div class="modal-actions">${buttons}</div>`:''}</div></div>`;
  const close=()=>{host.remove()};
  host.querySelectorAll('[data-pr49-close]').forEach(x=>x.addEventListener('click',close));
  host.querySelector('.modal-bg')?.addEventListener('click',e=>{if(e.target===e.currentTarget)close()});
  host.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  host.tabIndex=-1;
  requestAnimationFrame(()=>host.focus());
  return host;
}

const showError=message=>modalShell('Ошибка',`<p class="pr49-error">${esc(message)}</p>`);

function showForm(title,fields,submit){
  const body=`<form id="pr49-form">${fields.map(f=>f.select?`<label>${esc(f.label)}<select name="${esc(f.name)}" ${f.required?'required':''}>${f.options.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></label>`:`<label>${esc(f.label)}<input name="${esc(f.name)}" type="${f.type||'text'}" ${f.required?'required':''} value="${esc(f.value||'')}"></label>`).join('')}<p class="pr49-error" aria-live="polite"></p></form>`;
  const host=modalShell(title,body,'<button type="button" class="ui-btn ghost" data-pr49-close>Отмена</button><button type="submit" form="pr49-form" class="ui-btn primary">Сохранить</button>');
  host.querySelector('#pr49-form').onsubmit=async e=>{e.preventDefault();try{await submit(Object.fromEntries(new FormData(e.currentTarget)));host.remove();window.dispatchEvent(new CustomEvent('bjob:refresh'))}catch(err){e.currentTarget.querySelector('.pr49-error').textContent=err.message}};
  return host;
}

function permissionChecked(role,key,action){const matrix=permissionsForRole(role);return Boolean(matrix.all||matrix.sections?.[key]?.[action])}
function permissionMarkup(role){return SECTIONS.map(([label,key])=>`<div class="admin-permission-row"><b>${esc(label)}</b><div>${ACTIONS.map(a=>`<label><input type="checkbox" data-perm-section="${esc(key)}" data-perm-action="${a}" ${permissionChecked(role,key,a)?'checked':''}><span>${esc(actionLabels[a])}</span></label>`).join('')}</div></div>`).join('')}

function showUserForm(){
  const roles=roleValues.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');
  const sections=permissionMarkup('warehouse');
  const host=modalShell('Добавить сотрудника',`<form id="pr49-user-form"><div class="form-grid"><label>Логин<input name="login" autocomplete="username" required></label><label>Имя<input name="name" autocomplete="name" required></label><label>Роль<select name="role" data-role-select>${roles}</select></label></div><div class="form-section-head"><h3>Доступ к разделам</h3><p>Права по умолчанию устанавливаются ролью и могут быть изменены вручную.</p></div><div class="admin-permissions" data-permissions>${sections}</div><p class="pr49-error" aria-live="polite"></p></form>`,'<button type="button" class="ui-btn ghost" data-pr49-close>Отмена</button><button type="submit" form="pr49-user-form" class="ui-btn primary">Создать сотрудника</button>');
  const form=host.querySelector('#pr49-user-form');
  const roleSelect=form.querySelector('[data-role-select]');
  roleSelect.addEventListener('change',()=>{form.querySelector('[data-permissions]').innerHTML=permissionMarkup(normalizeRole(roleSelect.value))});
  form.onsubmit=async e=>{e.preventDefault();try{const permissions={sections:{}};form.querySelectorAll('[data-perm-section]').forEach(c=>{const s=c.dataset.permSection,a=c.dataset.permAction;(permissions.sections[s]??={})[a]=c.checked});const result=await createUser({login:form.login.value,name:form.name.value,role:normalizeRole(roleSelect.value),permissions});host.remove();modalShell('Сотрудник создан',`<div class="success-panel"><p>Сотрудник <b>${esc(result.name)}</b> создан.</p><p>Логин: <b>${esc(result.login)}</b></p><p>Одноразовый пароль:</p><div class="one-time-password">${esc(result.temporaryPassword)}</div>${result.inviteCode?`<p>Код приглашения:</p><div class="one-time-password">${esc(result.inviteCode)}</div>`:''}<small>Передайте данные сотруднику. При первом входе он установит постоянный пароль.</small></div>`,'<button type="button" class="ui-btn primary" data-pr49-close>Готово</button>');window.dispatchEvent(new CustomEvent('bjob:refresh'))}catch(err){form.querySelector('.pr49-error').textContent=err.message}};
}

function localizeVisibleRoles(){
  document.querySelectorAll('.list article small').forEach(node=>{const text=node.textContent||'';const parts=text.split('·').map(x=>x.trim());if(parts.length>=2){const candidate=parts[parts.length-1];if(['admin','manager','warehouse','picker','администратор','руководитель','сотрудник склада','наборщик','склад','сборщик'].includes(candidate.toLowerCase())){parts[parts.length-1]=roleLabel(normalizeRole(candidate));node.textContent=parts.join(' · ')}}});
}

function bind(){
  document.addEventListener('click',async e=>{
    const a=e.target.closest('[data-action]');
    if(!a)return;
    const action=a.dataset.action;
    if(!['add-shop','add-workspace','add-user','choose-shop','choose-workspace','toggle-user','backup-restore'].includes(action))return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try{
      if(action==='add-shop')return showForm('Добавить магазин',[{name:'name',label:'Название',required:true},{name:'marketplace',label:'Маркетплейс',required:true,select:true,options:[{value:'wb',label:'Wildberries'},{value:'ozon',label:'Ozon'}]}],v=>createShop(v));
      if(action==='add-workspace')return showForm('Создать рабочее пространство',[{name:'name',label:'Название',required:true},{name:'description',label:'Описание'}],v=>createWorkspace(v));
      if(action==='add-user')return showUserForm();
      if(action==='choose-shop'){await setActiveShop(a.dataset.id);return window.dispatchEvent(new CustomEvent('bjob:refresh'))}
      if(action==='choose-workspace'){await setActiveWorkspace(a.dataset.id);return window.dispatchEvent(new CustomEvent('bjob:refresh'))}
      if(action==='toggle-user'){const users=await listUsers(),u=users.find(x=>x.id===a.dataset.id);if(u)await setActive(u.id,u.active===false);return window.dispatchEvent(new CustomEvent('bjob:refresh'))}
      if(action==='backup-restore'){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{if(!input.files[0])return;try{const result=await window.BJobBackup.readBackupFile(input.files[0]);modalShell('Резервная копия восстановлена',`<p>Восстановлено записей: <b>${result.restored}</b></p>`,'<button type="button" class="ui-btn primary" data-pr49-reload>Перезапустить</button>');document.querySelector('[data-pr49-reload]')?.addEventListener('click',()=>location.reload())}catch(err){showError(err.message)}};input.click()}
    }catch(err){showError(err.message)}
  },true);
  const observer=new MutationObserver(()=>{injectBackupControl();localizeVisibleRoles()});
  observer.observe(document.body,{childList:true,subtree:true});
  injectBackupControl();
  localizeVisibleRoles();
}
function injectBackupControl(){const view=root();if(!view||document.querySelector('[data-action="backup-restore"]'))return;if(/Резервные копии/.test(view.textContent||'')){const target=view.querySelector('.action-row,.single-actions');if(target){const b=document.createElement('button');b.className='ui-btn';b.dataset.action='backup-restore';b.textContent='Восстановить JSON backup';target.appendChild(b)}}}
export function initPr49Ui(){bind()}
