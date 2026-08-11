const STYLE_ID = 'beltanee-demo-polish';

const css = `
.demo-loading-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(248,249,251,.72);backdrop-filter:blur(8px);opacity:1;transition:opacity .24s ease}
.demo-loading-overlay.is-hidden{opacity:0;pointer-events:none}
.demo-loading-card{min-width:260px;padding:24px;border:1px solid rgba(0,0,0,.06);border-radius:20px;background:rgba(255,255,255,.94);box-shadow:0 20px 60px rgba(20,24,32,.12);text-align:center}
.demo-loader{width:28px;height:28px;margin:0 auto 12px;border:3px solid rgba(0,0,0,.1);border-top-color:currentColor;border-radius:50%;animation:demo-spin .72s linear infinite}
.demo-loading-text{font-size:13px;color:var(--text-secondary,#6b7280)}
.demo-skeleton{position:relative;overflow:hidden;background:rgba(0,0,0,.055);border-radius:12px;min-height:72px}
.demo-skeleton:after{content:'';position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);animation:demo-shimmer 1.15s infinite}
.page.active .card,.page.active .kpi-card{animation:demo-rise .3s cubic-bezier(.22,1,.36,1) both}
.page.active .card:nth-child(2){animation-delay:.04s}.page.active .card:nth-child(3){animation-delay:.08s}.page.active .card:nth-child(4){animation-delay:.12s}
.btn,.card,.kpi-card{transition:transform .2s cubic-bezier(.22,1,.36,1),box-shadow .2s ease,opacity .2s ease}
.card:hover,.kpi-card:hover{transform:translateY(-1px)}
@keyframes demo-spin{to{transform:rotate(360deg)}}
@keyframes demo-shimmer{100%{transform:translateX(100%)}}
@keyframes demo-rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.demo-loader,.demo-skeleton:after{animation:none}.page.active .card,.page.active .kpi-card{animation:none}.btn,.card,.kpi-card{transition:none}}
`;

function ensureStyle(){
  if(document.getElementById(STYLE_ID)) return;
  const style=document.createElement('style'); style.id=STYLE_ID; style.textContent=css; document.head.appendChild(style);
}

function showLoader(text='Загружаем данные…'){
  let el=document.getElementById('demo-loading-overlay');
  if(!el){
    el=document.createElement('div'); el.id='demo-loading-overlay'; el.className='demo-loading-overlay';
    el.innerHTML='<div class="demo-loading-card"><div class="demo-loader"></div><div class="demo-loading-text"></div></div>';
    document.body.appendChild(el);
  }
  el.querySelector('.demo-loading-text').textContent=text;
  el.classList.remove('is-hidden');
  return el;
}

function hideLoader(){
  const el=document.getElementById('demo-loading-overlay');
  if(!el) return;
  el.classList.add('is-hidden');
  setTimeout(()=>el.remove(),260);
}

export function installDemoPolish(){
  ensureStyle();
  if(window.__beltaneeDemoPolishInstalled) return;
  window.__beltaneeDemoPolishInstalled=true;

  const original=window.navigateTo;
  if(typeof original==='function' && !original.__demoPolished){
    const navigate=function(page){
      showLoader('Загружаем раздел…');
      const result=original(page);
      window.setTimeout(hideLoader,180);
      return result;
    };
    navigate.__demoPolished=true;
    window.navigateTo=navigate;
  }

  window.showDemoLoader=showLoader;
  window.hideDemoLoader=hideLoader;
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',installDemoPolish,{once:true});
else installDemoPolish();
