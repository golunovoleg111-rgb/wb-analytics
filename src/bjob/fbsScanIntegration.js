function findPickButton(id){return [...document.querySelectorAll('[data-pick-box]')].find(x=>String(x.dataset.pickBox)===String(id))}
function focusBox(box){if(!box)return;const tryFocus=()=>{const b=findPickButton(box.id)||findPickButton(box.barcode);if(!b)return false;b.click();requestAnimationFrame(()=>b.scrollIntoView({behavior:'smooth',block:'center'}));return true};if(!tryFocus()){let n=0;const t=setInterval(()=>{if(tryFocus()||++n>20)clearInterval(t)},150)}}
window.addEventListener('bjob:fbs-qr-result',e=>{if(e.detail?.ok)focusBox(e.detail.box)});
window.addEventListener('bjob:navigate',e=>{if(e.detail?.page==='fbs'){setTimeout(()=>{const id=sessionStorage.getItem('bjob:fbs-open-box');if(id)focusBox({id})},250)}});
