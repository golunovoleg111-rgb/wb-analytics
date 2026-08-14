const lastActions=new Map();
export function once(key,fn,ttl=500){const now=Date.now(),prev=lastActions.get(key)||0;if(now-prev<ttl)return false;lastActions.set(key,now);fn();return true}
export function preventDoubleSubmit(form,handler){if(!form)return()=>{};let busy=false;return async e=>{e?.preventDefault?.();if(busy)return;busy=true;try{return await handler(e)}finally{busy=false}}}
export function focusIfVisible(el){if(!el)return false;const r=el.getBoundingClientRect();if(r.width<=0||r.height<=0)return false;el.focus({preventScroll:true});return true}
export function scrollIntoViewSafe(el){if(!el)return false;el.scrollIntoView?.({behavior:'smooth',block:'nearest'});return true}
