import {headers,validateHeader} from './importTemplates.js';
const norm=v=>String(v??'').trim();
export function detectTemplate(receivedHeaders=[]){for(const name of ['products','sales','stocks','advertising','warehouses','fbs']){const r=validateHeader(name,receivedHeaders);if(r.valid)return name;}return null;}
export function normalizeRows(template,rows=[]){return rows.map((row,i)=>{const out={_row:i+2};for(const key of headers(template))out[key]=norm(row[key]);return out;});}
export function validateRows(template,rows=[]){const required=headers(template);return rows.flatMap((row,i)=>required.filter(k=>!norm(row[k])).map(k=>({row:i+2,column:k,error:'Обязательное поле не заполнено'})));}
export function prepareImport(template,rows=[]){const errors=validateRows(template,rows);return {template,rows:normalizeRows(template,rows),errors,valid:errors.length===0};}
