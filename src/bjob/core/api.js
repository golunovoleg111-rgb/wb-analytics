// WB API adapter contracts. Credentials never belong in UI modules.
export const WB_ENDPOINTS={content:'https://content-api.wildberries.ru',statistics:'https://statistics-api.wildberries.ru',marketplace:'https://marketplace-api.wildberries.ru',advertising:'https://advert-api.wildberries.ru'};
export class WBApiError extends Error{constructor(message,status=0){super(message);this.name='WBApiError';this.status=status;}}
export async function wbRequest({base,path,token,method='GET',body,signal}={}){if(!base||!path)throw new WBApiError('Не задан адрес WB API.');if(!token)throw new WBApiError('Не настроен API-ключ WB.');const res=await fetch(`${base.replace(/\/$/,'')}/${String(path).replace(/^\//,'')}`,{method,signal,headers:{Authorization:token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});let data=null;try{data=await res.json();}catch{}if(!res.ok)throw new WBApiError(data?.message||`WB API вернул HTTP ${res.status}`,res.status);return data;}
export async function testConnection(config){return wbRequest({...config,path:config.path||'/ping'});}
export const API_MODULES=['content','statistics','marketplace','advertising'];
