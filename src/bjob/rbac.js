import {hasAccess,allowedSections,ACTIONS as ACCESS_ACTIONS} from './accessModel.js';
export {ACCESS_ACTIONS};
export function canAccess(user,section,action='view'){return hasAccess(user,section,action);}
export function normalizePermissions(value={}){const out={};for(const [section,raw] of Object.entries(value||{})){out[section]=typeof raw==='boolean'?Object.fromEntries(ACCESS_ACTIONS.map(a=>[a,raw])):{...Object.fromEntries(ACCESS_ACTIONS.map(a=>[a,false])),...raw};}return out;}
export function filterNavigation(items,user){return (items||[]).filter(item=>hasAccess(user,item.permission||item.key,'view'));}
export function guardAction(user,section,action,fn){if(!hasAccess(user,section,action))throw new Error(`Нет доступа: ${section}/${action}`);return fn();}
export function getAllowedSections(user){return allowedSections(user);}
