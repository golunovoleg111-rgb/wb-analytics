import * as DB from '../db.js';
import {createFbsSpace,createFbsBox,getSpaceStats,getBoxStock,getBoxFillPercent,withAccessibility} from './domain/fbsWarehouse.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number(v||0).toLocaleString('ru-RU');
const state={spaceId:null,selected:null,rendering:false};

const spaces=()=>DB.all('fbsSpaces');
const boxes=()=>DB.all('fbsBoxes');
async function ensureDefault(){let s=await spaces();if(s.length)return s;const x=createFbsSpace({id:`fbs-space-${Date.now()}`,name:'Основной FBS',address:'Основной склад',rows:3,positionsPerRow:6,maxLevels:6});await DB.put('fbsSpaces',x);return [x];}
function boxLabel(b){const c=b.coordinates;return `A${String(c.row).padStart(2,'0')}-${String(c.position).padStart(2,'0')}-${String(c.level).padStart(2,'0')}`;}
function activePage(){return document.querySelector('#mainNav button.active')?.dataset.page||'';}

async function render(){
  if(state.rendering||activePage()!=='fbs')return;
  const view=document.querySelector('#view');if(!view)return;
  state.rendering=true;
  try{
    const ss=await ensureDefault();
    if(!state.spaceId||!ss.some(x=>x.id===state.spaceId))state.spaceId=ss[0].id;
    const space=ss.find(x=>x.id===state.spaceId);const all=await boxes();
    const own=all.filter(x=>x.spaceId===space.id).map(x=>withAccessibility(x,all));
    const st=getSpaceStats(space,own);const rows=Array.from({length:space.rows},(_,i)=>i+1);const pos=Array.from({length:space.positionsPerRow},(_,i)=>i+1);
    const cells=rows.flatMap(r=>pos.map(p=>{const col=own.filter(x=>x.coordinates.row===r&&x.coordinates.position===p).sort((a,b)=>b.coordinates.level-a.coordinates.level);const top=col[0];const active=state.selected&&top?.id===state.selected;return `<button class="fbs-slot ${active?'selected ':''}${top?'occupied':'empty'}" data-fbs-column="${r}:${p}"><span class="fbs-slot-code">${top?esc(boxLabel(top)):`${r}-${p}`}</span><strong>${top?n(getBoxStock(top)):'+'}</strong><small>${top?(top.accessible?'доступна':'заблокирована'):'пусто'}</small></button>`})).join('');
    const selected=state.selected?own.find(x=>x.id===state.selected):null;
    const selectedCol=selected?own.filter(x=>x.coordinates.row===selected.coordinates.row&&x.coordinates.position===selected.coordinates.position).sort((a,b)=>b.coordinates.level-a.coordinates.level):[];
    view.innerHTML=`<div class="fbs-workspace"><div class="fbs-workspace-head"><div><small>FBS / ПРОСТРАНСТВО</small><h1>${esc(space.name)}</h1><p>${esc(space.address||'Без адреса')} · ${space.rows} рядов × ${space.positionsPerRow} позиций × ${space.maxLevels} уровней</p></div><div class="fbs-workspace-actions"><select id="fbs-space-select">${ss.map(x=>`<option value="${esc(x.id)}" ${x.id===space.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select><button class="btn primary" data-fbs-action="add-box">Добавить коробку</button><button class="btn secondary" data-fbs-action="add-space">Новое пространство</button></div></div><div class="fbs-metrics"><div><span>Коробок</span><b>${n(st.boxes)}</b></div><div><span>Товаров</span><b>${n(st.stock)}</b></div><div><span>Вместимость</span><b>${n(st.capacity)}</b></div><div><span>Доступны</span><b>${n(st.accessible)}</b></div><div><span>Заблокированы</span><b>${n(st.blocked)}</b></div></div><div class="fbs-layout"><section class="fbs-map"><div class="fbs-map-title"><h2>Карта склада</h2><span>Вид сверху · верхняя коробка в каждой ячейке</span></div><div class="fbs-grid" style="--cols:${space.positionsPerRow}">${cells}</div></section><aside class="fbs-stack"><h2>${selected?'Столбец '+selected.coordinates.row+' / '+selected.coordinates.position:'Выберите столбец'}</h2>${selected?`<div class="fbs-stack-list">${selectedCol.map(b=>`<button class="fbs-stack-box ${b.id===selected.id?'selected':''}" data-fbs-box="${esc(b.id)}"><span><b>${esc(boxLabel(b))}</b><small>Уровень ${b.coordinates.level} · ${b.accessible?'🟢 доступна':'🔒 заблокирована'}</small></span><strong>${n(getBoxStock(b))}</strong></button>`).join('')}</div><div class="fbs-box-detail"><h3>${esc(selected.name)}</h3><p>Физическое место: <b>${esc(boxLabel(selected))}</b></p><p>Остаток: <b>${n(getBoxStock(selected))}</b> · Заполнение: <b>${getBoxFillPercent(selected).toFixed(0)}%</b></p><p>${selected.accessible?'🟢 Коробку можно взять сейчас.':'🔒 Коробка физически заблокирована коробками сверху.'}</p><button class="btn secondary" data-fbs-action="add-stock" data-fbs-box-id="${esc(selected.id)}">Пополнить</button></div>`:'<p class="fbs-hint">Нажмите на столбец, чтобы увидеть все уровни. Нижние коробки блокируются коробками сверху.</p>'}</aside></div></div>`;
    view.querySelector('#fbs-space-select')?.addEventListener('change',e=>{state.spaceId=e.target.value;state.selected=null;render()});
    view.querySelectorAll('[data-fbs-column]').forEach(el=>el.addEventListener('click',()=>{const [r,p]=el.dataset.fbsColumn.split(':').map(Number);const col=own.filter(x=>x.coordinates.row===r&&x.coordinates.position===p).sort((a,b)=>b.coordinates.level-a.coordinates.level);state.selected=col[0]?.id||null;render()}));
    view.querySelectorAll('[data-fbs-box]').forEach(el=>el.addEventListener('click',()=>{state.selected=el.dataset.fbsBox;render()}));
    view.querySelector('[data-fbs-action="add-space"]')?.addEventListener('click',async()=>{const name=prompt('Название пространства:','FBS — новое пространство');if(!name)return;const id=`fbs-space-${Date.now()}`;await DB.put('fbsSpaces',createFbsSpace({id,name,rows:3,positionsPerRow:6,maxLevels:6}));state.spaceId=id;state.selected=null;render()});
    view.querySelector('[data-fbs-action="add-box"]')?.addEventListener('click',async()=>{const r=Number(prompt('Ряд:','1')),p=Number(prompt('Позиция:','1')),l=Number(prompt('Уровень:','1'));if(!r||!p||!l)return;const id=`fbs-box-${Date.now()}`;const box=createFbsBox({id,spaceId:space.id,row:r,position:p,level:l,name:`Коробка ${r}-${p}-${l}`,capacity:100});try{const current=await boxes();const {validateBoxPlacement}=await import('./domain/fbsWarehouse.js');validateBoxPlacement(box,space,current);await DB.put('fbsBoxes',box);state.selected=id;render()}catch(err){alert(err.message)}});
    view.querySelector('[data-fbs-action="add-stock"]')?.addEventListener('click',async()=>{const b=selected;if(!b)return;const article=prompt('Артикул товара:');const quantity=Number(prompt('Количество:','1'));if(!article||!quantity)return;const {addToFbsBox}=await import('./domain/fbsWarehouse.js');try{await DB.put('fbsBoxes',addToFbsBox(b,{variantId:article,article},quantity));render()}catch(err){alert(err.message)}});
  }finally{state.rendering=false;}
}

function schedule(){if(activePage()==='fbs')setTimeout(render,60);}
function hook(){document.querySelector('#mainNav')?.addEventListener('click',schedule);schedule();const observer=new MutationObserver(()=>{if(activePage()==='fbs'&&document.querySelector('.fbs-workspace')===null)schedule()});const view=document.querySelector('#view');if(view)observer.observe(view,{childList:true});}
window.addEventListener('load',hook);