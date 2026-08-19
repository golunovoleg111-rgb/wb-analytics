const state={user:null,workspaceId:null,shopId:null,mode:'OFFLINE'};
export function getAppState(){return {...state};}
export function setAppContext(patch={}){Object.assign(state,patch);return getAppState();}
export function clearAppContext(){state.user=null;state.workspaceId=null;state.shopId=null;state.mode='OFFLINE';return getAppState();}
export function subscribeAppState(listener){const handler=()=>listener(getAppState());window.addEventListener('bjob:state',handler);return()=>window.removeEventListener('bjob:state',handler);}
export function notifyAppState(){window.dispatchEvent(new CustomEvent('bjob:state'));return getAppState();}
