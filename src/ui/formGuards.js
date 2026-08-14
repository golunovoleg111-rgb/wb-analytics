export function required(value){return value!==null&&value!==undefined&&String(value).trim()!==''}
export function normalizeNumber(value,{min=0,max=Infinity,integer=false,fallback=min}={}){let n=Number(String(value??'').replace(',','.'));if(!Number.isFinite(n))n=fallback;if(integer)n=Math.trunc(n);return Math.min(max,Math.max(min,n))}
export function normalizeSku(value){return String(value??'').trim().replace(/\s+/g,' ')}
export function normalizeSize(value){return String(value??'').trim().toUpperCase()}
export function validateFields(fields={}){const errors={};for(const [key,value] of Object.entries(fields)){if(value?.required&&!required(value.value))errors[key]=value.message||'Поле обязательно'}return{ok:Object.keys(errors).length===0,errors}}
