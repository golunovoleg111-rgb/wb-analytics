export function assertFbsBootClean(){
  if(!document.querySelector('#app')) throw new Error('B-JOB: контейнер приложения не найден');
  return true;
}
