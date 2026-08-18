import * as DB from '../db.js';

const SESSION_KEY='bjob:v2:user';
const ACTIVE_SHOP_KEY='bjob:v2:active-shop';
const ORG_KEY='bjob:organization';
const LEGACY_ADMIN={login:'ADMIN',password:'ADMINB1',role:'admin',name:'Администратор'};
const enc=new TextEncoder();

async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',enc.encode(String(value)));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function token(size=12){const bytes=crypto.getRandomValues(new Uint8Array(size));return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,size*2).toUpperCase()}
function admin(){return session()?.role==='admin'}

async function ensure(){
  let users=await DB.all('users');
  if(!users.length){
    const now=new Date().toISOString();
    await DB.put('users',{id:'user-admin',login:LEGACY_ADMIN.login,name:LEGACY_ADMIN.name,role:LEGACY_ADMIN.role,passwordHash:await hash(LEGACY_ADMIN.password),active:true,mustChangePassword:true,createdAt:now,lastLoginAt:null,organizationId:'default',shopIds:[],permissions:{all:true},bootstrap:true});
    users=await DB.all('users');
  }
  if(!(await DB.get('settings','organization'))){
    await DB.put('settings',{id:'organization',key:ORG_KEY,name:'B-JOB',createdAt:new Date().toISOString()});
  }
  return users;
}

export async function ensureCore(){await ensure();return health()}
export async function health(){const [users,shops,organization]=await Promise.all([DB.all('users'),DB.all('shops'),DB.get('settings','organization')]);return {ready:true,dbVersion:DB.DB_VERSION,organization:!!organization,users:users.length,shops:shops.length,activeShopId:activeShopId()}}
export async function listUsers(){await ensure();return DB.all('users')}
export async function listShops(){await ensure();return DB.all('shops')}
export async function createShop({name,marketplace}){
  if(!admin())throw new Error('Требуются права администратора.');
  const cleanName=String(name||'').trim();
  const mp=String(marketplace||'').trim().toLowerCase();
  if(!cleanName||!['wb','ozon'].includes(mp))throw new Error('Укажите название и маркетплейс WB или Ozon.');
  const shops=await DB.all('shops');
  if(shops.some(x=>String(x.name).trim().toLowerCase()===cleanName.toLowerCase()))throw new Error('Магазин с таким названием уже существует.');
  const shop={id:`shop-${crypto.randomUUID()}`,name:cleanName,marketplace:mp,organizationId:'default',active:true,createdAt:new Date().toISOString()};
  await DB.put('shops',shop);
  if(!activeShopId())localStorage.setItem(ACTIVE_SHOP_KEY,shop.id);
  return shop;
}
export async function setActiveShop(id){
  const shops=await DB.all('shops');
  const shop=shops.find(x=>x.id===id&&x.active!==false);
  if(!shop)throw new Error('Магазин не найден или отключён.');
  const current=session();
  if(current?.role!=='admin'&&!current?.shopIds?.includes(id))throw new Error('Нет доступа к магазину.');
  localStorage.setItem(ACTIVE_SHOP_KEY,id);
  return shop;
}
export function activeShopId(){try{return localStorage.getItem(ACTIVE_SHOP_KEY)||null}catch{return null}}
export async function activeShop(){const id=activeShopId();return id?(await DB.all('shops')).find(x=>x.id===id)||null:null}

export async function login(login,password){
  const users=await ensure();
  const normalized=String(login||'').trim().toUpperCase();
  const user=users.find(x=>String(x.login).toUpperCase()===normalized&&x.active!==false);
  if(!user||user.passwordHash!==await hash(password))return null;
  const firstLogin=!!user.mustChangePassword;
  const now=new Date().toISOString();
  try{await DB.put('authEvents',{id:`auth-${crypto.randomUUID()}`,type:'login',userId:user.id,login:user.login,name:user.name,organizationId:user.organizationId,date:now,deviceId:localStorage.getItem('bjob:device-id')||null,confirmed:false,firstLogin})}catch(error){console.warn('B-JOB: не удалось записать событие авторизации',error)}
  const current={id:user.id,login:user.login,name:user.name,role:user.role,organizationId:user.organizationId,shopIds:user.shopIds||[],permissions:user.permissions||{},mustChangePassword:firstLogin};
  sessionStorage.setItem(SESSION_KEY,JSON.stringify(current));
  await DB.put('users',{...user,lastLoginAt:now});
  return current;
}
export async function confirmAuthEvent(id){if(!admin())throw new Error('Требуются права администратора.');const event=await DB.get('authEvents',id);if(!event)throw new Error('Событие авторизации не найдено.');await DB.put('authEvents',{...event,confirmed:true,confirmedAt:new Date().toISOString(),confirmedBy:session().id})}
export async function pendingAuthEvents(){if(!admin())return [];return (await DB.all('authEvents')).filter(x=>x.type==='login'&&!x.confirmed).sort((a,b)=>String(b.date).localeCompare(String(a.date)))}
export async function completeFirstLogin(password){
  const current=session();
  if(!current?.mustChangePassword)throw new Error('Смена пароля сейчас не требуется.');
  if(String(password||'').length<8)throw new Error('Постоянный пароль должен содержать минимум 8 символов.');
  const user=await DB.get('users',current.id);
  if(!user)throw new Error('Пользователь не найден.');
  await DB.put('users',{...user,passwordHash:await hash(password),mustChangePassword:false,bootstrap:false});
  const next={...current,mustChangePassword:false};
  sessionStorage.setItem(SESSION_KEY,JSON.stringify(next));
  return next;
}
export function session(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
export function logout(){sessionStorage.removeItem(SESSION_KEY)}
export function hasRole(...roles){const current=session();return !!current&&roles.includes(current.role)}
export function can(section,action='view',shopId=activeShopId()){
  const current=session();
  if(!current)return false;
  if(current.role==='admin'||current.permissions?.all)return true;
  if(shopId&&!current.shopIds?.includes(shopId))return false;
  const permission=current.permissions?.sections?.[section];
  if(permission===true)return true;
  if(Array.isArray(permission))return permission.includes(action);
  if(permission&&typeof permission==='object')return permission[action]===true;
  return false;
}
export async function createUser({login,name,role='warehouse',shopIds=[],permissions={},temporaryPassword,invite=false}){
  if(!admin())throw new Error('Требуются права администратора.');
  await ensure();
  const normalized=String(login||'').trim().toUpperCase();
  if(!normalized||!name)throw new Error('Укажите логин и имя.');
  const users=await DB.all('users');
  if(users.some(x=>String(x.login).toUpperCase()===normalized))throw new Error('Такой логин уже существует.');
  const shops=await DB.all('shops');
  const validShopIds=(shopIds||[]).filter(id=>shops.some(x=>x.id===id&&x.active!==false));
  const oneTime=temporaryPassword||token(6);
  const user={id:`user-${crypto.randomUUID()}`,login:normalized,name:String(name).trim(),role,passwordHash:await hash(oneTime),active:true,mustChangePassword:true,createdAt:new Date().toISOString(),lastLoginAt:null,organizationId:'default',shopIds:validShopIds,permissions};
  await DB.put('users',user);
  const result={userId:user.id,login:user.login,name:user.name,temporaryPassword:oneTime,shopIds:validShopIds,role};
  if(invite){const invitation={id:`invite-${crypto.randomUUID()}`,code:`BJOB-${token(4)}-${token(4)}`,userId:user.id,organizationId:'default',shopIds:validShopIds,expiresAt:new Date(Date.now()+7*86400000).toISOString(),used:false,createdAt:new Date().toISOString()};await DB.put('invitations',invitation);result.inviteCode=invitation.code}
  return result;
}
export async function listInvitations(){if(!admin())return [];return DB.all('invitations')}
export async function acceptInvitation(code,{login,name,password}){const invites=await DB.all('invitations'),inv=invites.find(x=>x.code===String(code||'').trim().toUpperCase()&&!x.used&&new Date(x.expiresAt)>new Date());if(!inv)throw new Error('Приглашение недействительно или просрочено.');const user=await DB.get('users',inv.userId);if(!user)throw new Error('Пользователь приглашения не найден.');await DB.put('users',{...user,login:String(login||user.login).trim().toUpperCase(),name:String(name||user.name).trim(),passwordHash:await hash(password),mustChangePassword:false});await DB.put('invitations',{...inv,used:true,usedAt:new Date().toISOString()});return true}
export async function setActive(id,active){if(!admin())throw new Error('Требуются права администратора.');const user=await DB.get('users',id);if(!user)throw new Error('Пользователь не найден.');await DB.put('users',{...user,active:!!active})}
export async function changePassword(id,password){if(!admin())throw new Error('Требуются права администратора.');if(String(password||'').length<8)throw new Error('Пароль должен содержать минимум 8 символов.');const user=await DB.get('users',id);if(!user)throw new Error('Пользователь не найден.');await DB.put('users',{...user,passwordHash:await hash(password),mustChangePassword:false})}
export async function setUserAccess(id,{shopIds,role,permissions}){if(!admin())throw new Error('Требуются права администратора.');const user=await DB.get('users',id);if(!user)throw new Error('Пользователь не найден.');const shops=await DB.all('shops'),validShopIds=(shopIds||[]).filter(s=>shops.some(x=>x.id===s&&x.active!==false));await DB.put('users',{...user,shopIds:validShopIds,role:role||user.role,permissions:permissions||user.permissions||{}})}
export async function organization(){await ensure();return DB.get('settings','organization')}
