import { createShop, createUser, createWorkspace, setActiveShop, setActiveWorkspace, setActive, listUsers } from './userAuth.js';
import { SECTIONS, ACTIONS, roleOptions, normalizeRole, permissionsForRole } from './accessModel.js';

const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const root=()=>document.querySelector('#view');
const actionLabels={view:'Просмотр',create:'Создание',edit:'Изменение',delete:'Удаление',import:'Импорт',export:'Экспорт',manage:'Управление'};
const roleList=roleOptions();

function modalShell(title,body,buttons='<button type="button" class="ui-btn ghost" data-pr49-close>Закрыть</button>'){
  let host=document.querySelector('#pr49-modal');
  if(!host){host=document.createElement('div');host.id='pr49-modal';document.body.appendChild(host)}
  host.innerHTML=`<div class="modal-bg" role="presentation"><div class="modal pr49-modal" role="dialog" aria-modal="true" aria-labelledby="pr49-title"><button type="button" class="close" data-pr49-close aria-label="Закрыть">×</button><h2 id="pr49-title">${esc(title)}</h2>${body}${buttons?`<div class="pr49-modal-actions">${buttons}</div>`:''}</div></div>`;
  host.querySelectorAll('[data-pr49-close]').forEach(x=>x.addEventListener('click',()=>host.remove()));
  host.querySelector('.modal-bg')?.addEventListener('click',e=>{if(e.target===e.currentTarget)host.remove()});
  host.addEventListener('keydown',e=>{if(e.key==='Escape')host.remove()});
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

function blankMatrix(){return Object.fromEntries(SECTIONS.map(([,section])=>[section,Object.fromEntries(ACTIONS.map(action=>[action,false]))]));}
function roleMatrix(role){const source=permissionsForRole(role);const matrix=blankMatrix();if(source.all){for(const section of Object.keys(matrix))for(const action of ACTIONS)matrix[section][action]=true;return matrix}for(const [section,actions] of Object.entries(source.sections||{})){if(!matrix[section])continue;for(const action of ACTIONS)matrix[section][action]=Boolean(actions?.[action])}return matrix;}
function permissionMarkup(matrix){return SECTIONS.map(([label,key])=>`<section class="pr49-access-row" data-section="${esc(key)}"><div class="pr49-access-title"><b>${esc(label)}</b><span class="pr49-access-count" data-count-for="${esc(key)}"></span></div><div class="pr49-perm-grid">${ACTIONS.map(action=>`<label class="pr49-perm"><input type="checkbox" data-perm-section="${esc(key)}" data-perm-action="${action}" ${matrix[key]?.[action]?'checked':''}><span>${esc(actionLabels[action])}</span></label>`).join('')}</div></section>`).join('');}
function syncCounts(form){form.querySelectorAll('[data-section]').forEach(row=>{const key=row.dataset.section;const total=ACTIONS.length;const checked=row.querySelectorAll(`input[data-perm-section="${CSS.escape(key)}"]:checked`).length;const count=row.querySelector(`[data-count-for="${CSS.escape(key)}"]`);if(count)count.textContent=checked===total?'Все права':checked?`${checked}/${total}`:'Нет прав'})}
function setPermissionPreset(form,preset,role){const matrix=preset==='role'?roleMatrix(role):blankMatrix();if(preset==='all'){for(const section of Object.keys(matrix))for(const action of ACTIONS)matrix[section][action]=true}if(preset==='view'){for(const section of Object.keys(matrix))matrix[section].view=true}form.querySelectorAll('[data-perm-section]').forEach(input=>{input.checked=Boolean(matrix[input.dataset.permSection]?.[input.dataset.permAction])});syncCounts(form);}
function readPermissions(form){const permissions={sections:blankMatrix()};form.querySelectorAll('[data-perm-section]').forEach(input=>{permissions.sections[input.dataset.permSection][input.dataset.permAction]=input.checked});return permissions;}

function showUserForm(){
  const matrix=roleMatrix('warehouse');
  const roles=roleList.map(({value,label})=>`<option value="${esc(value)}" ${value==='warehouse'?'selected':''}>${esc(label)}</option>`).join('');
  const host=modalShell('Добавить сотрудника',`<form id="pr49-user-form"><div class="pr49-form-grid"><label>Логин<input name="login" autocomplete="username" required></label><label>Имя<input name="name" autocomplete="name" required></label><label>Роль<select name="role" data-role-select>${roles}</select></label></div><div class="pr49-access-head"><div><h3>Доступ к разделам</h3><p>Роль задаёт права по умолчанию. Их можно изменить вручную.</p></div><div class="pr49-access-tools"><button type="button" class="ui-btn small" data-perm-preset="role">По роли</button><button type="button" class="ui-btn small" data-perm-preset="view">Только просмотр</button><button type="button" class="ui-btn small" data-perm-preset="all">Все права</button><button type="button" class="ui-btn small ghost" data-perm-preset="none">Сбросить</button></div></div><div class="pr49-access-grid" data-permissions>${permissionMarkup(matrix)}</div><p class="pr49-error" aria-live="polite"></p></form>`,'<button type="button" class="ui-btn ghost" data-pr49-close>Отмена</button><button type="submit" form="pr49-user-form" class="ui-btn primary">Создать сотрудника</button>');
  const form=host.querySelector('#pr49-user-form');
  const roleSelect=form.querySelector('[data-role-select]');
  roleSelect.addEventListener('change',()=>{setPermissionPreset(form,'role',normalizeRole(roleSelect.value));});
  form.querySelectorAll('[data-perm-preset]').forEach(button=>button.addEventListener('click',()=>setPermissionPreset(form,button.dataset.permPreset==='none'?'none':button.dataset.permPreset,normalizeRole(roleSelect.value))));
  form.addEventListener('change',e=>{if(e.target.matches('[data-perm-section]'))syncCounts(form)});
  syncCounts(form);
  form.onsubmit=async e=>{e.preventDefault();try{const result=await createUser({login:form.login.value,name:form.name.value,role:normalizeRole(roleSelect.value),permissions:readPermissions(form)});host.remove();modalShell('Сотрудник создан',`<div class="success-panel"><p>Сотрудник <b>${esc(result.name)}</b> создан.</p><p>Логин: <b>${esc(result.login)}</b></p><p>Одноразовый пароль:</p><div class="pr49-password"><b>${esc(result.temporaryPassword)}</b></div><small>При первом входе сотрудник должен установить постоянный пароль.</small></div>`,'<button type="button" class="ui-btn primary" data-pr49-close>Готово</button>');window.dispatchEvent(new CustomEvent('bjob:refresh'))}catch(err){form.querySelector('.pr49-error').textContent=err.message}};
}

function bind(){
  document.addEventListener('click',async e=>{const a=e.target.closest('[data-action]');if(!a)return;const action=a.dataset.action;if(!['add-shop','add-workspace','add-user','choose-shop','choose-workspace','toggle-user','backup-restore'].includes(action))return;e.preventDefault();e.stopImmediatePropagation();try{if(action==='add-shop')return showForm('Добавить магазин',[{name:'name',label:'Название',required:true},{name:'marketplace',label:'Маркетплейс',required:true,select:true,options:[{value:'wb',label:'Wildberries'},{value:'ozon',label:'Ozon'}]}],v=>createShop(v));if(action==='add-workspace')return showForm('Создать рабочее пространство',[{name:'name',label:'Название',required:true},{name:'description',label:'Описание'}],v=>createWorkspace(v));if(action==='add-user')return showUserForm();if(action==='choose-shop'){await setActiveShop(a.dataset.id);return window.dispatchEvent(new CustomEvent('bjob:refresh'))}if(action==='choose-workspace'){await setActiveWorkspace(a.dataset.id);return window.dispatchEvent(new CustomEvent('bjob:refresh'))}if(action==='toggle-user'){const users=await listUsers(),u=users.find(x=>x.id===a.dataset.id);if(u)await setActive(u.id,u.active===false);return window.dispatchEvent(new CustomEvent('bjob:refresh'))}if(action==='backup-restore'){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{if(!input.files[0])return;try{const result=await window.BJobBackup.readBackupFile(input.files[0]);modalShell('Резервная копия восстановлена',`<p>Восстановлено записей: <b>${result.restored}</b></p>`,'<button type="button" class="ui-btn primary" data-pr49-reload>Перезапустить</button>');document.querySelector('[data-pr49-reload]')?.addEventListener('click',()=>location.reload())}catch(err){showError(err.message)}};input.click()}}catch(err){showError(err.message)}},true);
  const observer=new MutationObserver(()=>injectBackupControl());observer.observe(document.body,{childList:true,subtree:true});injectBackupControl();
}
function injectBackupControl(){const view=root();if(!view||document.querySelector('[data-action="backup-restore"]'))return;if(/Резервные копии/.test(view.textContent||'')){const target=view.querySelector('.single-actions,.action-row');if(target){const b=document.createElement('button');b.dataset.action='backup-restore';b.textContent='Восстановить JSON backup';target.appendChild(b)}}}
export function initPr49Ui(){bind()}