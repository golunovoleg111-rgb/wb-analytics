import * as DB from '../db.js';

export async function exportBackup(){
  const snapshot=await DB.snapshot();
  return {format:'bjob-backup',version:1,dbVersion:DB.DB_VERSION,createdAt:new Date().toISOString(),stores:snapshot};
}

export async function restoreBackup(payload,{clear=true}={}){
  const data=payload?.stores||payload;
  if(!data||typeof data!=='object')throw new Error('Файл backup не распознан.');
  if(payload?.format&&payload.format!=='bjob-backup')throw new Error('Это не backup B-JOB.');
  const total=await DB.restoreSnapshot(data,{clear});
  try{localStorage.removeItem('bjob:v2:route');}catch{}
  return {restored:total,dbVersion:DB.DB_VERSION};
}

export async function readBackupFile(file){
  if(!file)throw new Error('Файл не выбран.');
  let parsed;try{parsed=JSON.parse(await file.text())}catch{throw new Error('JSON backup повреждён или имеет неверный формат.')}
  return restoreBackup(parsed);
}
