export const SYNC_VERSION=1;
export const SyncState=Object.freeze({OFFLINE:'offline',SYNCING:'syncing',ONLINE:'online',ERROR:'error'});
export function makeMutation({store,id,operation,payload,baseVersion=null,userId=null}){return{id:String(id??crypto.randomUUID()),store,operation,payload,baseVersion,userId,clientId:getClientId(),version:SYNC_VERSION,createdAt:new Date().toISOString()}}
export function getClientId(){const key='bjob-client-id';let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id)}return id}
export function mergeRecords(local=[],remote=[]){const map=new Map(remote.map(x=>[String(x.id),x]));for(const item of local){const key=String(item.id);const r=map.get(key);if(!r||new Date(item.updatedAt||0)>new Date(r.updatedAt||0))map.set(key,item)}return [...map.values()]}
export function isOnline(){return typeof navigator!=='undefined'&&navigator.onLine!==false}
