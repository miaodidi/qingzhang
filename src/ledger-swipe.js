// Delegation also covers search results and month/filter rerenders.
export function setupLedgerSwipe(root){
 let drag=null,suppressed=null;
 const width=76;
 function settle(row,open){
  if(!row?.isConnected)return;
  row.classList.remove('swiping');row.classList.toggle('swipe-open',open);row.style.removeProperty('--swipe-x');
  row.querySelector('.ledger-delete').hidden=!open;
  row.querySelector('.transaction').setAttribute('aria-expanded',String(open));
 }
 function closeOthers(except){for(const row of root.querySelectorAll('.ledger-swipe.swipe-open'))if(row!==except)settle(row,false);}
 root.addEventListener('pointerdown',e=>{
  suppressed=null;const row=e.target.closest('.ledger-swipe');closeOthers(row);
  if(!row||!e.isPrimary||e.button!==0||e.target.closest('.ledger-delete'))return;
  drag={row,id:e.pointerId,x:e.clientX,y:e.clientY,start:row.classList.contains('swipe-open')?-width:0,offset:0,locked:false};
 });
 root.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.locked){
   if(Math.max(Math.abs(dx),Math.abs(dy))<10)return;
   if(Math.abs(dy)>=Math.abs(dx)){suppressed=drag.row;drag=null;return;}
   drag.locked=true;drag.row.setPointerCapture(e.pointerId);drag.row.classList.add('swiping');
  }
  e.preventDefault();drag.offset=Math.max(-width,Math.min(0,drag.start+dx));drag.row.style.setProperty('--swipe-x',`${drag.offset}px`);
 });
 function finish(e){
  if(!drag||e.pointerId!==drag.id||(e.type==='lostpointercapture'&&e.target!==drag.row))return;
  const d=drag;drag=null;if(d.locked)suppressed=d.row;
  settle(d.row,e.type==='pointerup'&&d.locked?d.offset<=-32:d.start<0);
 }
 for(const name of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(name,finish);
 root.addEventListener('click',e=>{
  const row=e.target.closest('.ledger-swipe');
  if(row&&row===suppressed){suppressed=null;e.preventDefault();e.stopImmediatePropagation();return;}
  if(row?.classList.contains('swipe-open')&&!e.target.closest('.ledger-delete')){settle(row,false);e.preventDefault();e.stopImmediatePropagation();}
 },true);
 root.addEventListener('keydown',e=>{
  suppressed=null;const row=e.target.closest('.ledger-swipe');if(!row)return;
  if(e.target.matches('.transaction')&&['ArrowLeft','ArrowRight','Escape'].includes(e.key)){e.preventDefault();closeOthers(row);settle(row,e.key==='ArrowLeft');}
 });
 root.addEventListener('focusin',e=>closeOthers(e.target.closest('.ledger-swipe')));
}
