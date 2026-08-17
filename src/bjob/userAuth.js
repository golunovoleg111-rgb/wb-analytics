import * as DB from '../db.js';

const SESSION_KEY='bjob:v2:user';
const ORG_KEY='bjob:organization';
const LEGACY={ADMIN:{password:'ADMINB1',role:'admin',name:'Администратор'},SKLAD:{password:'SKLAD1',role:'warehouse',name:'Склад'}};

const enc=new TextEncoder();
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',enc.encode(String(value)));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function ensure(){
  const users=await DB.all('users');
  if(users.length)return users;
  const now=new Date().toISOString();
  const seeded=[];
  for(const [login,c] of Object.entries(LEGACY))seeded.push({id:`user-${login.toLowerCase()}`,login,name:c.name,role:c.role,passwordHash:await hash(c.password),active:true,createdAt:now,lastLoginAt:null,organizationId:'default'});
  await DB.putMany('users',seeded);
  if(!(await DB.get('settings','organization'))){await DB.put('settings',{id:'organization',key:ORG_KEY,name:'B-JOB',createdAt:now});}
  return seeded;
}
export async function listUsers(){await ensure();return DB.all('users');}
export async function login(login,password){const users=await ensure();const normalized=String(login||'').trim().toUpperCase();const user=users.find(x=>String(x.login).toUpperCase()===normalized&&x.active!==false);if(!user||user.passwordHash!==await hash(password))return null;const session={id:user.id,login:user.login,name:user.name,role:user.role,organizationId:user.organizationId};sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));await DB.put('users',{...user,lastLoginAt:new Date().toISOString()});return session;}
export function session(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
export function logout(){sessionStorage.removeItem(SESSION_KEY)}
export function hasRole(...roles){const s=session();return !!s&&roles.includes(s.role)}
export async function createUser({login,name,password,role='warehouse'}){await ensure();const normalized=String(login||'').trim().toUpperCase();if(!normalized||!password||!name)throw new Error('Заполните логин, имя и пароль.');const users=await DB.all('users');if(users.some(x=>String(x.login).toUpperCase()===normalized))throw new Error('Такой логин уже существует.');const user={id:`user-${crypto.randomUUID()}`,login:normalized,name:String(name).trim(),role,passwordHash:await hash(password),active:true,createdAt:new Date().toISOString(),lastLoginAt:null,organizationId:'default'};await DB.put('users',user);return user;}
export async function setActive(id,active){const user=await DB.get('users',id);if(!user)throw new Error('Пользователь не найден.');await DB.put('users',{...user,active:!!active});}
export async function changePassword(id,password){if(!password)throw new Error('Пароль не может быть пустым.');const user=await DB.get('users',id);if(!user)throw new Error('Пользователь не найден.');await DB.put('users',{...user,passwordHash:await hash(password)});}
export async function organization(){await ensure();return DB.get('settings','organization');}
