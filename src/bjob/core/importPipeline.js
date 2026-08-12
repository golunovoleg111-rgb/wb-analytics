import {headers,validateHeader} from './importTemplates.js';
export function normalizeHeader(v){return String(v??'').trim().toLowerCase().replace(/\s+/g,' ');}
export function validateRows(template,rows=[]){const expected=headers(template);const first=rows[0]||{};const keys=Object.keys(first);const normalized=new Map(keys.map(k=>[normalizeHeader(k),k]));const missing=expected.filter(x=>!normalized.has(normalizeHeader(x)));return {valid:missing.length===0,missing,columns:keys,rows:rows.length};}
export function mapRows(template,rows=[]){const expected=headers(template);return rows.map(row=>Object.fromEntries(expected.map(h=>{const key=Object.keys(row).find(k=>normalizeHeader(k)===normalizeHeader(h));return [h,key===undefined?'':row[key]];})));}
export function importPlan(template,rows=[]){const check=validateRows(template,rows);if(!check.valid)return {ok:false,errors:check.missing.map(x=>`Отсутствует колонка: ${x}`)};return {ok:true,rows:mapRows(template,rows),count:rows.length};}
