import {makeMutation,SyncState,isOnline} from './syncContract.js';
export function createDataRepository({apiBase='',cache,fetchImpl=globalThis.fetch}={}){
  let state=apiBase?(isOnline()?SyncState.ONLINE:SyncState.OFFLINE):SyncState.OFFLINE;
  const listeners=new Set();
  const setState=s=>{state=s;listeners.forEach(fn=>fn(state))};
  async function request(path,options={}){
    if(!apiBase){setState(SyncState.OFFLINE);throw new Error('OFFLINE_NO_API')}
    if(typeof fetchImpl!=='function')throw new Error('FETCH_NOT_AVAILABLE');
    const url=`${apiBase.replace(/\/$/,'')}${path}`;
    setState(SyncState.SYNCING);
    try{const r=await fetchImpl(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});if(!r.ok)throw new Error(`API_${r.status}`);const data=await r.json();setState(SyncState.ONLINE);return data}
    catch(e){setState(isOnline()?SyncState.ERROR:SyncState.OFFLINE);throw e}
  }
  return{
    getState:()=>state,
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},
    async list(store){if(!apiBase){if(cache?.get)return cache.get(store);return []}try{return await request(`/api/${encodeURIComponent(store)}`)}catch(e){if(cache?.get)return cache.get(store);throw e}},
    async mutate(store,operation,payload){const mutation=makeMutation({store,operation,payload});if(!apiBase){await cache?.queueMutation?.(mutation);setState(SyncState.OFFLINE);return {queued:true,mutation}}try{if(operation==='clear')return await request(`/api/${encodeURIComponent(store)}`,{method:'DELETE'});return await request(`/api/${encodeURIComponent(store)}`,{method:'POST',body:JSON.stringify(mutation)})}catch(e){await cache?.queueMutation?.(mutation);throw e}},
    async health(){if(!apiBase)return {ok:false,offline:true};return request('/api/health')}
  };
}
