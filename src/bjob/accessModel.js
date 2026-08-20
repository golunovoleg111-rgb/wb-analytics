export const ROLES={
  admin:{label:'Администратор',system:true},
  manager:{label:'Руководитель'},
  warehouse:{label:'Сотрудник склада'},
  picker:{label:'Наборщик'}
};
export const SECTIONS=[['Главная','home'],['Отчёты','reports'],['Товары','products'],['Магазины','shops'],['Склады','warehouses'],['Поставки','shipments'],['Производство','production'],['Интеграции','integrations'],['Управление','management'],['FBS','fbs'],['FBS аналитика','fbsAnalytics']];
export const ACTIONS=['view','create','edit','delete','import','export','manage'];
const ALL=Object.fromEntries(ACTIONS.map(action=>[action,true]));
const roleSections={
  manager:['home','reports','products','shops','warehouses','shipments','production','integrations','fbs','fbsAnalytics','management'],
  warehouse:['home','warehouses','fbs'],
  picker:['home','fbs']
};
const roleActions={
  manager:['view','create','edit','delete','import','export','manage'],
  warehouse:['view','create','edit'],
  picker:['view','edit']
};
export function createAccessMatrix(){return Object.fromEntries(SECTIONS.map(([,key])=>[key,Object.fromEntries(ACTIONS.map(action=>[action,false]))]));}
export function permissionsForRole(role){const key=normalizeRole(role);if(key==='admin')return {all:true};const matrix=createAccessMatrix();for(const section of roleSections[key]||[]){for(const action of roleActions[key]||['view'])matrix[section][action]=true;}return {sections:matrix};}
export function normalizeRole(role){const value=String(role||'').trim().toLowerCase();if(value==='admin'||value==='администратор')return'admin';if(value==='manager'||value==='руководитель')return'manager';if(value==='warehouse'||value==='сотрудник склада'||value==='сотрудник')return'warehouse';if(value==='picker'||value==='наборщик')return'picker';return'warehouse';}
export function roleLabel(role){return ROLES[normalizeRole(role)]?.label||ROLES.warehouse.label;}
export function normalizeUser(user={}){const role=normalizeRole(user.role);const defaults=permissionsForRole(role);return {...user,role,roleLabel:roleLabel(role),permissions:user.permissions?.all?user.permissions:mergePermissions(defaults,user.permissions)};}
function mergePermissions(base,custom={}){if(custom.all)return{all:true};const sections={...(base.sections||{})};for(const [key,value] of Object.entries(custom.sections||custom||{})){if(value&&typeof value==='object'&&!Array.isArray(value))sections[key]={...(sections[key]||{}),...value};else if(typeof value==='boolean')sections[key]=value?{...ALL}:{...(sections[key]||{})};}return{sections};}
export function hasAccess(user,section,action='view'){const normalized=normalizeUser(user);if(normalized.role==='admin'||normalized.permissions?.all)return true;const permission=normalized.permissions?.sections?.[section]??normalized.permissions?.[section];if(permission===true)return true;if(Array.isArray(permission))return permission.includes(action);return Boolean(permission&&typeof permission==='object'&&permission[action]);}
export function allowedSections(user){return SECTIONS.filter(([,key])=>hasAccess(user,key)).map(([label,key])=>({label,key}));}
export function canManageAccess(user){return hasAccess(user,'management','manage');}
export function roleOptions(){return Object.entries(ROLES).map(([value,{label}])=>({value,label}));}
