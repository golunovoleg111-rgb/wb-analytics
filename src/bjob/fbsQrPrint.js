export function qrPayload(box){return `BJOB-FBS|${box.id}|${box.code}`}

export function printQrLabel(box){
  const payload=qrPayload(box);
  const w=window.open('','_blank','width=520,height=620');
  if(!w)throw Error('Разрешите всплывающие окна для печати QR.');
  const qrUrl=`https://quickchart.io/qr?text=${encodeURIComponent(payload)}&size=420&margin=1`;
  w.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${String(box.code).replace(/[<>]/g,'')}</title><style>@page{size:58mm 60mm;margin:0}html,body{width:58mm;height:60mm;margin:0;padding:0}body{display:grid;place-items:center;background:#fff;color:#000;font:700 11px Arial,sans-serif}.label{width:54mm;height:56mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2mm;box-sizing:border-box}.qr{width:42mm;height:42mm;object-fit:contain}.code{font-size:10px;letter-spacing:.3px;line-height:1;white-space:nowrap}.meta{font-size:7px;font-weight:500;line-height:1}</style></head><body><div class="label"><img class="qr" src="${qrUrl}" alt="QR"><div class="code">${String(box.code).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</div><div class="meta">B-JOB FBS · ${String(box.id).slice(-8)}</div></div><script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print()},350));</script></body></html>`);
  w.document.close();
}
