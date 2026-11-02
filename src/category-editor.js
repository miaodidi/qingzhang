import {addCategory,removeCategory,categoryReferences,setCategoryOrder} from './category-catalog.js';
export function setupCategoryEditor(root,{getState,commit,redraw}){
 let editing=false,drag=null,timer=0,suppress=false,scrollFrame=0;
 const form=()=>root.querySelector('#tx-form'),grid=()=>root.querySelector('#category-choices');
 const type=()=>form()?.elements.type.value;
 const selected=()=>form()?.elements.categoryId?.value;
 function refresh(id=selected()){redraw(id,editing);}
 function stop(){clearTimeout(timer);cancelAnimationFrame(scrollFrame);drag?.ghost?.remove();drag?.item?.classList.remove('category-dragging');drag=null;}
 function enter(){if(!form()||type()==='transfer')return;editing=true;document.activeElement?.blur();refresh();}
 function reset(){stop();editing=false;}
 root.addEventListener('modal-close',reset);
 root.addEventListener('click',async e=>{
  const button=e.target.closest('[data-category-action]');if(!button)return;e.preventDefault();e.stopPropagation();
  const action=button.dataset.categoryAction,panel=root.querySelector('#category-editor-panel');
  if(action==='edit'){enter();return;}if(action==='done'){editing=false;refresh();return;}
  if(action==='cancel'){panel.replaceChildren();return;}
  if(action==='add'){
   panel.innerHTML='<label>分类名称<input id="new-category-name" maxlength="20" placeholder="例如：咖啡" autocomplete="off"></label><p class="form-error" role="alert"></p><div class="category-editor-actions"><button type="button" data-category-action="cancel">取消</button><button type="button" class="primary small" data-category-action="create">添加分类</button></div>';
   panel.querySelector('input').focus();panel.scrollIntoView({block:'nearest'});return;
  }
  if(action==='create'){
   let id;const name=panel.querySelector('input').value,t=type();if(await commit(s=>{id=addCategory(s,t,name);})){refresh(id);}return;
  }
  if(action==='delete'){
   const id=button.dataset.id,s=getState(),c=s.categories.find(c=>c.id===id),others=s.categories.filter(x=>x.type===c.type&&x.id!==id),refs=categoryReferences(s,id);
   if(!others.length){panel.textContent='每种类型至少保留一个分类';return;}
   panel.replaceChildren();const p=document.createElement('p');p.textContent=`删除“${c.name}”？`;
   panel.append(p);const used=Object.values(refs).some(Boolean);
   if(used){const hint=document.createElement('p');hint.className='footnote';hint.textContent=`此分类关联 ${refs.transactions} 笔账单、${refs.budgets} 个月预算、${refs.rules} 项周期计划。请选择接收分类；分类预算会相加，总预算不变。`;panel.append(hint);const select=document.createElement('select');select.id='category-replacement';select.setAttribute('aria-label','接收分类');const empty=new Option('请选择接收分类','');select.add(empty);for(const other of others)select.add(new Option(other.name,other.id));panel.append(select);}
   const actions=document.createElement('div');actions.className='category-editor-actions';actions.innerHTML='<button type="button" data-category-action="cancel">取消</button><button type="button" class="primary small" data-category-action="confirm-delete">确认删除</button>';actions.lastChild.dataset.id=id;panel.append(actions);panel.scrollIntoView({block:'nearest'});return;
  }
  if(action==='confirm-delete'){
   const id=button.dataset.id,replacement=panel.querySelector('select')?.value,old=selected();if(await commit(s=>removeCategory(s,id,replacement))){refresh(old===id?replacement:old);}return;
  }
 });
 root.addEventListener('click',e=>{if(e.target.closest('.category-choice')&&(editing||suppress)&&!e.target.closest('[data-category-action]')){e.preventDefault();e.stopImmediatePropagation();}suppress=false;},true);
 function move(x,y){
  if(!drag?.ghost)return;drag.x=x;drag.y=y;drag.ghost.style.left=`${x-drag.dx}px`;drag.ghost.style.top=`${y-drag.dy}px`;
  const target=document.elementFromPoint(x,y)?.closest('.category-choice');if(!target||target===drag.item||target.parentElement!==grid())return;
  const items=[...grid().querySelectorAll('.category-choice')];if(items.indexOf(target)>items.indexOf(drag.item))target.after(drag.item);else target.before(drag.item);
 }
 function autoscroll(){if(!drag?.ghost)return;const body=root.querySelector('.sheet-body'),r=body.getBoundingClientRect();const delta=drag.y<r.top+45?-8:drag.y>r.bottom-45?8:0;if(delta){body.scrollTop+=delta;move(drag.x,drag.y);}scrollFrame=requestAnimationFrame(autoscroll);}
 function start(item,e){
  const r=item.getBoundingClientRect(),ghost=item.cloneNode(true);ghost.classList.add('category-drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.querySelectorAll('input,button').forEach(n=>n.remove());document.body.append(ghost);ghost.style.width=r.width+'px';ghost.style.height=r.height+'px';item.classList.add('category-dragging');
  drag={item,ghost,id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top,x:e.clientX,y:e.clientY};root.setPointerCapture(e.pointerId);suppress=true;move(e.clientX,e.clientY);autoscroll();
 }
 root.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('[data-category-action]'))return;const item=e.target.closest('.category-choice');if(!item)return;
  stop();if(editing){e.preventDefault();start(item,e);return;}
  drag={id:e.pointerId,x:e.clientX,y:e.clientY};timer=setTimeout(()=>{drag=null;suppress=true;enter();},480);
 });
 root.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(!drag.ghost){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8)stop();return;}e.preventDefault();move(e.clientX,e.clientY);});
 root.addEventListener('pointerup',async e=>{if(!drag||drag.id!==e.pointerId){clearTimeout(timer);return;}const reordered=!!drag.ghost,ids=[...(grid()?.querySelectorAll('.category-choice')||[])].map(n=>n.dataset.id),t=type();stop();if(reordered){await commit(s=>setCategoryOrder(s,t,ids));refresh();}});
 root.addEventListener('pointercancel',()=>{const active=!!drag?.ghost;stop();if(active)refresh();});
 root.addEventListener('contextmenu',e=>{if(e.target.closest('.category-choice'))e.preventDefault();});
 root.addEventListener('keydown',async e=>{if(e.target.id==='new-category-name'&&e.key==='Enter'){e.preventDefault();root.querySelector('[data-category-action=create]')?.click();return;}const item=e.target.closest('.category-choice');if(!editing||!item||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const items=[...grid().querySelectorAll('.category-choice')],i=items.indexOf(item),j=Math.max(0,Math.min(items.length-1,i+({ArrowLeft:-1,ArrowRight:1,ArrowUp:-5,ArrowDown:5}[e.key])));const ids=items.map(n=>n.dataset.id);ids.splice(j,0,ids.splice(i,1)[0]);await commit(s=>setCategoryOrder(s,type(),ids));const id=item.dataset.id;refresh();grid()?.querySelector(`[data-id="${id}"]`)?.focus();});
 return {reset,isEditing:()=>editing};
}
