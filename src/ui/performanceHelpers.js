export function chunk(items=[],size=100){const out=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out}
export function debounce(fn,wait=150){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait)}}
export function memoize(fn){let has=false,lastKey,lastValue;return(...args)=>{const key=JSON.stringify(args);if(has&&key===lastKey)return lastValue;lastKey=key;lastValue=fn(...args);has=true;return lastValue}}
export function visibleSlice(items=[],start=0,count=100){return items.slice(Math.max(0,start),Math.max(0,start)+Math.max(0,count))}
