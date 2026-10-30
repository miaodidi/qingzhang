// This UI preference stays on this device and does not change the ledger.
export function createFloatingCapture({app,onActivate}){
 const button=document.createElement('button');
 button.type='button';button.className='floating-capture';button.hidden=true;
 button.setAttribute('aria-label','截图记账（可拖动）');button.title='点击截图记账，拖动调整位置';
 button.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 3H4v4m12-4h4v4M4 17v4h4m12-4v4h-4M8 8h8v8H8z"/></svg><span>截图记账</span>';
 document.body.append(button);
 let position={x:1,y:1},drag=null,blockedClick=false;
 try{const saved=JSON.parse(localStorage.getItem('qingzhang-capture-position'));if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))position=saved;}catch{}
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function bounds(){
  const v=window.visualViewport,rect=app.getBoundingClientRect();
  const left=Math.max(rect.left,v?.offsetLeft||0)+12;
  const right=Math.max(left,Math.min(rect.right,(v?.offsetLeft||0)+(v?.width||innerWidth))-button.offsetWidth-12);
  const top=(v?.offsetTop||0)+Math.max(12,parseFloat(getComputedStyle(button).getPropertyValue('--float-safe-top'))||0);
  const nav=app.querySelector('.bottom-nav')?.getBoundingClientRect();
  const bottom=Math.max(top,Math.min((v?.offsetTop||0)+(v?.height||innerHeight),nav?.top??innerHeight)-button.offsetHeight-14);
  return {left,right,top,bottom};
 }
 function place(){if(button.hidden)return;const b=bounds();position.x=clamp(position.x,0,1);position.y=clamp(position.y,0,1);button.style.left=`${b.left+(b.right-b.left)*position.x}px`;button.style.top=`${b.top+(b.bottom-b.top)*position.y}px`;}
 function save(){try{localStorage.setItem('qingzhang-capture-position',JSON.stringify(position));}catch{}}
 button.addEventListener('pointerdown',e=>{
  if(e.button!==0||drag)return;
  blockedClick=false;const rect=button.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top,moved:false};button.setPointerCapture(e.pointerId);
 });
 button.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.moved&&Math.hypot(dx,dy)<8)return;
  drag.moved=true;blockedClick=true;button.classList.add('dragging');
  const b=bounds();position={x:b.right===b.left?0:clamp((drag.left+dx-b.left)/(b.right-b.left),0,1),y:b.bottom===b.top?0:clamp((drag.top+dy-b.top)/(b.bottom-b.top),0,1)};place();
 });
 function finish(e){if(!drag||e.pointerId!==drag.id)return;if(e.type==='pointercancel')blockedClick=true;if(drag.moved)save();drag=null;button.classList.remove('dragging');}
 button.addEventListener('pointerup',finish);button.addEventListener('pointercancel',finish);button.addEventListener('lostpointercapture',finish);
 button.addEventListener('click',e=>{if(blockedClick&&e.detail!==0){e.preventDefault();e.stopPropagation();blockedClick=false;return;}onActivate();});
 window.addEventListener('resize',place);window.visualViewport?.addEventListener('resize',place);window.visualViewport?.addEventListener('scroll',place);
 return {update(visible){button.hidden=!visible;if(!visible){drag=null;button.classList.remove('dragging');}place();}};
}
