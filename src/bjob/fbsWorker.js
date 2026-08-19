import {getFbsTasks,buildRoadmap,takeFromBox,getWarehouseMode,setWarehouseMode} from './fbsOperations.js';

export function startFbsWorker({onRefresh,intervalMs=300000}={}){
  let stopped=false;
  const tick=async()=>{ if(stopped) return; try{ if(onRefresh) await onRefresh(await getFbsTasks()); }catch(error){ console.warn('B-JOB FBS refresh',error); } };
  tick(); const timer=setInterval(tick,intervalMs);
  return ()=>{stopped=true;clearInterval(timer)};
}

export {getFbsTasks,buildRoadmap,takeFromBox,getWarehouseMode,setWarehouseMode};
