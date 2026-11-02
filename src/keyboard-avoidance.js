// iOS resizes/pans the visual viewport rather than the layout viewport.
// Keep the focused field inside the actual visible part of its scroll container.
export function setupKeyboardAvoidance(modalRoot){
 const viewport=window.visualViewport;
 if(!viewport)return;
 const gap=24;
 let session=null,frame=0,settleTimer=0,restoreTimer=0,followUntil=0,touch=null,checkTimer=0,checkFrame=0;
 let appliedHeight=-1,appliedTop=-1;
 const mobileWebKit=/AppleWebKit/.test(navigator.userAgent)&&(/iP(ad|hone|od)/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 let restingHeight=viewport.height,restingWidth=viewport.width,restingScale=viewport.scale;
 const editable=el=>el instanceof HTMLElement&&!el.matches(':disabled,[readonly]')&&(el.matches('textarea,select,[contenteditable="true"]')||el.matches('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]):not([type=button]):not([type=submit]):not([type=range]):not([type=color])'));
 function containers(el){
  // The modal body owns scrolling, even when a nested form/wrapper has overflow.
  const body=el.closest('.sheet-body');if(body)return [body];
  const list=[];for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){if(p.scrollHeight>p.clientHeight+1&&/(auto|scroll)/.test(getComputedStyle(p).overflowY))list.push(p);}return list;
 }
 function remember(el){
  if(!editable(el))return;
  if(session&&session.owner!==el.closest('.sheet-body'))reset();
  if(session){for(const node of containers(el))if(!session.scrolls.has(node))session.scrolls.set(node,{top:node.scrollTop,left:node.scrollLeft});return;}
  session={owner:el.closest('.sheet-body'),height:Math.max(restingHeight,viewport.height),width:viewport.width,scale:viewport.scale,x:window.scrollX,y:window.scrollY,scrolls:new Map(containers(el).map(node=>[node,{top:node.scrollTop,left:node.scrollLeft}])),keyboard:false,adjusted:false};
 }
 function reset(){touch=null;clearTimeout(checkTimer);cancelAnimationFrame(checkFrame);clearTimeout(settleTimer);session?.spacer?.remove();modalRoot.classList.remove('keyboard-open');session=null;clearTimeout(restoreTimer);restoreTimer=0;}
 function restore(){
  if(!session)return;
  const saved=session;reset();
  if(!saved.adjusted)return;
  for(const [node,pos] of saved.scrolls)if(node.isConnected&&Math.abs(node.scrollTop-pos.top)>1)node.scrollTo({top:pos.top,left:pos.left,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  // A modal already locks the background; touching window scroll here makes iOS pan again.
  if(!saved.owner&&(window.scrollX!==saved.x||window.scrollY!==saved.y))window.scrollTo({top:saved.y,left:saved.x,behavior:'instant'});
 }
 function keepVisible(el){
  const parents=containers(el),scroller=parents[0],rect=el.getBoundingClientRect();
  let top=viewport.offsetTop+gap,bottom=viewport.offsetTop+viewport.height-gap;
  if(scroller){const bounds=scroller.getBoundingClientRect();top=Math.max(top,bounds.top+gap);bottom=Math.min(bottom,bounds.bottom-gap);}
  // A sticky Save bar is another obstruction, even though it is above the keyboard.
  const footer=scroller?.closest('.sheet')?.querySelector('.sheet-footer')||(!scroller?document.querySelector('.bottom-nav'):null);
  if(footer){const bounds=footer.getBoundingClientRect();if(bounds.top<bottom&&bounds.bottom>top)bottom=Math.min(bottom,bounds.top-gap);}
  if(bottom<=top)return;
  const delta=rect.height>bottom-top?rect.top-top:rect.bottom>bottom?rect.bottom-bottom:rect.top<top?rect.top-top:0;
  if(Math.abs(delta)<1)return;
  session.adjusted=true;
  if(scroller)scroller.scrollTop+=delta;
  else {
   const page=document.scrollingElement,remaining=page.scrollHeight-page.clientHeight-window.scrollY;
   if(delta>remaining){if(!session.spacer){session.spacer=document.createElement('div');session.spacer.setAttribute('aria-hidden','true');document.body.append(session.spacer);}session.spacer.style.height=`${session.spacer.offsetHeight+Math.max(0,page.clientHeight+delta-session.spacer.getBoundingClientRect().bottom)+1}px`;}
   window.scrollBy({top:delta,behavior:'instant'});
  }
 }
 function update(){
  frame=0;
  if(appliedHeight!==viewport.height){modalRoot.style.setProperty('--visible-height',`${viewport.height}px`);appliedHeight=viewport.height;}
  if(appliedTop!==viewport.offsetTop){modalRoot.style.setProperty('--visible-top',`${viewport.offsetTop}px`);appliedTop=viewport.offsetTop;}
  if(Math.abs(viewport.width-restingWidth)>40||Math.abs(viewport.scale-restingScale)>.05){restingHeight=viewport.height;restingWidth=viewport.width;restingScale=viewport.scale;reset();return;}
  // Keep the unobscured baseline even if Safari delivers resize before focusin.
  restingHeight=Math.max(restingHeight,viewport.height);
  if(!session)return;
  // Rotation and pinch zoom are not keyboard events; do not undo deliberate zooming.
  if(Math.abs(viewport.width-session.width)>40||Math.abs(viewport.scale-session.scale)>.05){reset();return;}
  const loss=session.height-viewport.height;
  if(loss>120){if(!session.keyboard){session.keyboard=true;modalRoot.classList.add('keyboard-open');}clearTimeout(restoreTimer);restoreTimer=0;}
  if(session.keyboard&&loss<80){
   if(!restoreTimer)restoreTimer=setTimeout(()=>{restoreTimer=0;if(session&&session.height-viewport.height<80)restore();},500);
   return;
  }
  // Geometry writes above invalidate layout. Measure only after the viewport has
  // stopped changing and the browser has had a frame to apply the new dimensions.
  if(!session.keyboard&&!editable(document.activeElement))reset();

 }
 function follow(){clearTimeout(restoreTimer);restoreTimer=0;followUntil=performance.now()+1400;schedule();}
 function schedule(){
  if(!frame)frame=requestAnimationFrame(update);
  clearTimeout(checkTimer);cancelAnimationFrame(checkFrame);
  checkTimer=setTimeout(()=>{checkTimer=0;checkFrame=requestAnimationFrame(()=>{
   checkFrame=0;const field=document.activeElement;
   if(session?.keyboard&&session.height-viewport.height>120&&editable(field)&&performance.now()<followUntil)keepVisible(field);
  });},80);
 }
 // Capture before Safari's native focus scrolling, not after it has moved the page.
 document.addEventListener('pointerdown',e=>{const field=editable(e.target)?e.target:e.target.closest('label')?.control;if(editable(field)){remember(field);}else followUntil=0;},true);
 document.addEventListener('focusin',e=>{if(editable(e.target)){remember(e.target);follow();}});
 document.addEventListener('focusout',schedule);
 // Apply the same preventScroll focus principle used by mobile overlay frameworks,
 // scoped to first taps in our sheets; leave caret placement and text selection native.
 modalRoot.addEventListener('touchstart',e=>{
  if(!mobileWebKit||e.touches.length!==1)return;
  const field=e.target.closest('input,textarea')||e.target.closest('label')?.control;
  if(!editable(field)||field.tagName==='SELECT'||document.activeElement===field)return;
  const t=e.touches[0];touch={field,x:t.clientX,y:t.clientY,moved:false};remember(field);
 },{passive:true});
 modalRoot.addEventListener('touchmove',e=>{if(touch){const t=e.touches[0];if(!t||Math.hypot(t.clientX-touch.x,t.clientY-touch.y)>8)touch.moved=true;}},{passive:true});
 modalRoot.addEventListener('touchend',e=>{const t=touch;touch=null;if(!t||t.moved||!t.field.isConnected||!e.cancelable)return;e.preventDefault();t.field.focus({preventScroll:true});follow();},{passive:false});
 modalRoot.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
 modalRoot.addEventListener('modal-close',reset);
 viewport.addEventListener('resize',follow);viewport.addEventListener('scroll',schedule);
 window.addEventListener('resize',follow);
 document.addEventListener('scroll',()=>{if(session&&performance.now()<followUntil)schedule();},true);
 document.addEventListener('touchmove',()=>{followUntil=0;},{passive:true});
 document.addEventListener('wheel',()=>{followUntil=0;},{passive:true});
 update();
}
