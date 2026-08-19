export const ACCESS_ACTIONS=['view','create','edit','delete','export','import','manage'];
export function canAccess(user,section,action='view'){if(user?.role==='admin'||user?.isAdmin)return true;return Boolean(user?.permissions?.[section]?.[action] ?? (action==='view'&&user?.permissions?.[section]));}
export function normalizePermissions(value={}){const out={};for(const [section,raw] of Object.entries(value||{})){out[section]=typeof raw==='boolean'?Object.fromEntries(ACCESS_ACTIONS.map(a=>[a,raw])):{...Object.fromEntries(ACCESS_ACTIONS.map(a=>[a,false])),...raw};}return out;}
export function filterNavigation(items,user){return (items||[]).filter(item=>canAccess(user,item.permission||item.key,'view'));}
export function guardAction(user,section,action,fn){if(!canAccess(user,section,action))throw new Error(`Нет доступа: ${section}/${action}`);return fn();}
