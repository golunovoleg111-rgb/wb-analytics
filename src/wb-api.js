const BASE='https://common-api.wildberries.ru';
export function normalizeToken(token){return String(token||'').trim();}
export async function testConnection(token){const key=normalizeToken(token);if(!key)throw new Error('API-ключ не указан');const r=await fetch(`${BASE}/ping`,{headers:{Authorization:key}});if(!r.ok)throw new Error(`WB API: HTTP ${r.status}`);return true;}
export async function request(path,{token,method='GET',body}={}){const key=normalizeToken(token);if(!key)throw new Error('API-ключ не указан');const r=await fetch(`${BASE}${path}`,{method,headers:{Authorization:key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const text=await r.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok)throw new Error(`WB API: HTTP ${r.status}`);return data;}
export async function fetchOrders(token,dateFrom){return request('/api/v3/orders',{token});}
export async function fetchStocks(token){return request('/api/v3/stocks',{token});}
export async function fetchProducts(token){return request('/content/v2/get/cards/list',{token,method:'POST',body:{settings:{cursor:{limit:100},filter:{withPhoto:-1}}}});}
