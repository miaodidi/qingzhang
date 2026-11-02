// Delegate gestures so newly added budget rows work without rebinding listeners.
export function setupBudgetSwipe(root){
 let drag=null;
 const rows=()=>root.querySelectorAll('.budget-swipe');
 function settle(row,open){if(!row?.isConnected)return;row.classList.remove('swiping');row.classList.toggle('swipe-open',open);row.style.removeProperty('--swipe-x');row.querySelector('.budget-swipe-delete').hidden=!open;row.setAttribute('aria-expanded',String(open));}
 function closeOthers(except){for(const row of rows())if(row!==except)settle(row,false);}
 root.addEventListener('pointerdown',e=>{
  const row=e.target.closest('.budget-swipe');closeOthers(row);
  if(!row||e.button!==0||!e.isPrimary||e.target.closest('input,button,select'))return;
  drag={row,id:e.pointerId,x:e.clientX,y:e.clientY,start:row.classList.contains('swipe-open')?-76:0,offset:0,locked:false};
 });
 root.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.locked){if(Math.max(Math.abs(dx),Math.abs(dy))<10)return;if(Math.abs(dy)>=Math.abs(dx)){drag=null;return;}drag.locked=true;drag.row.setPointerCapture(e.pointerId);drag.row.classList.add('swiping');}
  e.preventDefault();drag.offset=Math.max(-76,Math.min(0,drag.start+dx));drag.row.style.setProperty('--swipe-x',`${drag.offset}px`);
 });
 function finish(e){if(!drag||e.pointerId!==drag.id||(e.type==='lostpointercapture'&&e.target!==drag.row))return;const d=drag;drag=null;settle(d.row,e.type==='pointerup'&&d.locked?d.offset<=-32:d.start<0);}
 root.addEventListener('pointerup',finish);root.addEventListener('pointercancel',finish);root.addEventListener('lostpointercapture',finish);
 root.addEventListener('focusin',e=>{if(e.target.matches('input')){closeOthers(null);}});
 root.addEventListener('keydown',e=>{const row=e.target.closest('.budget-swipe');if(!row||e.target!==row)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();closeOthers(row);settle(row,e.key==='ArrowLeft');}});
}
