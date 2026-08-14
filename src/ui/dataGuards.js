export function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
export function nonNegative(value,fallback=0){return Math.max(0,finite(value,fallback))}
export function clamp(value,min=0,max=100){return Math.min(max,Math.max(min,finite(value,min)))}
export function text(value,fallback='—'){return value==null||String(value).trim()===''?fallback:String(value)}
export function array(value){return Array.isArray(value)?value:[]}
export function uniqueBy(items,key){const out=[],seen=new Set();for(const item of array(items)){const k=String(typeof key==='function'?key(item):item?.[key]??item);if(seen.has(k))continue;seen.add(k);out.push(item)}return out}
export function positiveInt(value,fallback=0){const n=Math.floor(finite(value,fallback));return Math.max(0,n)}
