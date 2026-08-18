import * as DB from '../../db.js';
import * as Auth from '../userAuth.js';

const API_BASE=(()=>{try{return localStorage.getItem('bjob_api_base')||''}catch{return ''}})();
export const CORE_VERSION='3.0.0-core-reset';
let bootPromise=null;
let bootState={status:'idle',health:null,error:null};

export function apiUrl(path){if(!path.startsWith('/'))path=`/${path}`;return `${API_BASE}${path}`}
export async function apiFetch(path,options={}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),options.timeout??3500);
  try{return await fetch(apiUrl(path),{...options,signal:options.signal||controller.signal,headers:{Accept:'application/json',...(options.headers||{})}})}
  finally{clearTimeout(timeout)}
}
export async function apiAvailable(){try{const response=await apiFetch('/api/health',{timeout:1500});return response.ok}catch{return false}}

export async function boot(){
  if(bootPromise)return bootPromise;
  bootState={status:'starting',health:null,error:null};
  bootPromise=(async()=>{
    try{
      await DB.all('settings');
      const health=await Auth.ensureCore();
      bootState={status:'ready',health:{...health,coreVersion:CORE_VERSION,localFirst:DB.isLocalFirst()}};
      return bootState.health;
    }catch(error){
      bootState={status:'failed',health:null,error};
      bootPromise=null;
      throw new Error(`B-JOB Core boot failed: ${error?.message||error}`);
    }
  })();
  return bootPromise;
}
export function state(){return bootState}
export async function health(){if(bootState.status!=='ready')await boot();return bootState.health}
export async function snapshot(){await boot();return DB.snapshot()}
export async function reset(){bootPromise=null;bootState={status:'resetting',health:null,error:null};await DB.reset();bootState={status:'idle',health:null,error:null};return true}
export {DB,Auth};
