export async function withFeedback({run,onStart,onSuccess,onError,onFinally}={}){onStart?.();try{const result=await run();onSuccess?.(result);return result}catch(error){onError?.(error);return null}finally{onFinally?.()}}
export function dispatchFeedback(type,text,extra={}){window.dispatchEvent(new CustomEvent('bjob:toast',{detail:{type,text,...extra}}))}
export function success(text='Готово'){dispatchFeedback('success',text)}
export function info(text){dispatchFeedback('info',text)}
export function error(text='Не удалось выполнить действие'){dispatchFeedback('error',text)}
