export function selectAllVisible(boxes=[], predicate=()=>true){return boxes.filter(predicate).map(b=>String(b.id))}
export function toggleSelection(selected=[],id){const s=new Set(selected.map(String));const k=String(id);s.has(k)?s.delete(k):s.add(k);return [...s]}
export function selectionSummary(boxes=[],selected=[]){const ids=new Set(selected.map(String));const chosen=boxes.filter(b=>ids.has(String(b.id)));return{count:chosen.length,units:chosen.reduce((n,b)=>n+(Number(b.quantity)||Number(b.qty)||0),0)}}
export function clearSelection(){return []}
