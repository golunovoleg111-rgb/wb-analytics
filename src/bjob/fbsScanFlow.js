export const ScanStage=Object.freeze({IDLE:'idle',BOX:'box',ITEM:'item',DONE:'done'});
export function createScanSession(){return{stage:ScanStage.BOX,boxId:null,items:new Map(),scanned:0,errors:[]}}
export function scanBox(session,box){if(!box)return{...session,stage:ScanStage.BOX,errors:[...session.errors,'BOX_NOT_FOUND']};return{...session,stage:ScanStage.ITEM,boxId:String(box.id),scanned:0,errors:[]}}
export function scanItem(session,item,box){if(!box||String(session.boxId)!==String(box.id))return{...session,errors:[...session.errors,'WRONG_BOX']};const key=String(item?.barcode||item?.sku||item?.id||'');if(!key)return{...session,errors:[...session.errors,'ITEM_CODE_REQUIRED']};const available=Number(item?.available??item?.qty??0);if(available<=0)return{...session,errors:[...session.errors,'OUT_OF_STOCK']};const next=new Map(session.items);next.set(key,(next.get(key)||0)+1);return{...session,items:next,scanned:session.scanned+1}}
export function finishScan(session){return{...session,stage:ScanStage.DONE}}
export function resetScan(){return createScanSession()}
