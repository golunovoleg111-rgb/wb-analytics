export function createBackupSnapshot(state={}){return {version:1,createdAt:new Date().toISOString(),state};}
export function validateBackup(snapshot){return Boolean(snapshot&&snapshot.version&&snapshot.createdAt&&snapshot.state&&typeof snapshot.state==='object');}
export async function restoreBackup(snapshot,apply){if(!validateBackup(snapshot))throw new Error('Некорректная резервная копия');if(typeof apply!=='function')throw new Error('Не задан обработчик восстановления');return apply(snapshot.state);}
