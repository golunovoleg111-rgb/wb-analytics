export const SECTIONS=[['Главная','home'],['Отчёты','reports'],['Товары','products'],['Магазины','shops'],['Склады','warehouses'],['Поставки','shipments'],['Производство','production'],['Интеграции','integrations'],['Управление','management'],['FBS аналитика','fbsAnalytics']];
export const ACTIONS=['view','create','edit','delete','import','export','manage'];
export function createAccessMatrix(){return Object.fromEntries(SECTIONS.map(([,key])=>[key,Object.fromEntries(ACTIONS.map(action=>[action,false]))]));}
export function normalizeUser(user={}){return {...user,role:user.role||'Сотрудник',permissions:{...createAccessMatrix(),...(user.permissions||{})}};}
export function hasAccess(user,section,action='view'){if(!user)return false;if(user.role==='Администратор'||user.role==='admin'||user.isAdmin)return true;return Boolean(user.permissions?.[section]?.[action]);}
export function allowedSections(user){return SECTIONS.filter(([,key])=>hasAccess(user,key)).map(([label,key])=>({label,key}));}
export function canManageAccess(user){return hasAccess(user,'management','manage');}
