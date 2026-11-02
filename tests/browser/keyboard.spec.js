import {test,expect} from '@playwright/test';
// Mobile browser emulation has no OS keyboard. Change only the visual viewport,
// as Safari does, while retaining the real page/sheet layout and scrolling.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{
 const v=new EventTarget();Object.assign(v,{height:874,width:402,offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(window,'visualViewport',{get:()=>v});
 window.testKeyboard=(height,offsetTop=0)=>{v.height=height;v.offsetTop=offsetTop;v.dispatchEvent(new Event('resize'));v.dispatchEvent(new Event('scroll'));};
 });});
async function keyboard(page,h,offset=0){await page.evaluate(([h,o])=>window.testKeyboard(h,o),[h,offset]);}
async function openNote(page){await page.goto('/');await page.locator('.bottom-nav [data-action=add]').click();const note=page.locator('#tx-form [name=note]');await note.scrollIntoViewIfNeeded();await page.locator('.sheet').evaluate(el=>el.getAnimations().forEach(a=>a.finish()));return note;}
async function bounds(field){return field.evaluate(el=>{const r=el.getBoundingClientRect(),s=el.closest('.sheet-body'),b=s?.getBoundingClientRect(),f=s?.closest('.sheet')?.querySelector('.sheet-footer')?.getBoundingClientRect(),v=visualViewport;return {top:r.top,bottom:r.bottom,min:Math.max(v.offsetTop+24,b?b.top+24:0),max:Math.min(v.offsetTop+v.height-24,b?b.bottom-24:Infinity,f?f.top-24:Infinity)};});}
async function visibleWithGap(field){await expect.poll(async()=>{const b=await bounds(field);return b.top>=b.min-1&&b.bottom<=b.max+1;}).toBe(true);}
test('bottom note stays above keyboard with gap, preserves draft and restores original scroll',async({page})=>{
 const note=await openNote(page),body=page.locator('.sheet-body');const before=await body.evaluate(e=>e.scrollTop);await note.evaluate(e=>e.focus({preventScroll:true}));await keyboard(page,420,32);await visibleWithGap(note);await note.fill('晚饭备注测试');await keyboard(page,380,48);await visibleWithGap(note);await note.blur();await keyboard(page,874);await expect.poll(()=>body.evaluate(e=>e.scrollTop)).toBeCloseTo(before,0);await expect(note).toHaveValue('晚饭备注测试');
});
test('top input does not scroll unnecessarily; switching to low field uses same keyboard session',async({page})=>{
 await page.goto('/');await page.locator('.bottom-nav [data-action=add]').click();const body=page.locator('.sheet-body'),amount=page.locator('[name=amount]');await page.locator('.sheet').evaluate(el=>el.getAnimations().forEach(a=>a.finish()));await amount.evaluate(e=>e.focus({preventScroll:true}));const before=await body.evaluate(e=>e.scrollTop);await keyboard(page,520);await visibleWithGap(amount);expect(await body.evaluate(e=>e.scrollTop)).toBe(before);const note=page.locator('[name=note]');await note.evaluate(e=>e.focus({preventScroll:true}));await visibleWithGap(note);await keyboard(page,874);await expect.poll(()=>body.evaluate(e=>e.scrollTop)).toBeCloseTo(before,0);
});
test('budget field avoids sticky Save bar, and opening a different dialog does not restore old dialog',async({page})=>{
 await page.goto('/');await page.locator('[data-action=budget]').click();const input=page.locator('.budget-fields input').nth(6),body=page.locator('.sheet-body');await input.scrollIntoViewIfNeeded();const before=await body.evaluate(e=>e.scrollTop);await input.evaluate(e=>e.focus({preventScroll:true}));await keyboard(page,430);await visibleWithGap(input);await input.fill('888');await input.blur();await keyboard(page,874);await expect.poll(()=>body.evaluate(e=>e.scrollTop)).toBeCloseTo(before,0);await expect(input).toHaveValue('888');await page.locator('[data-action=close]').click();await page.locator('.bottom-nav [data-action=add]').click();await expect(page.locator('[name=amount]')).toBeVisible();
});
test('page search scrolls only if obstructed and returns to previous position',async({page})=>{
 await page.goto('/');await page.locator('.bottom-nav [data-action=ledger]').click();const search=page.locator('#search');await search.evaluate(e=>e.focus({preventScroll:true}));const before=await page.evaluate(()=>scrollY);await keyboard(page,460);await visibleWithGap(search);expect(await page.evaluate(()=>scrollY)).toBe(before);await keyboard(page,280);await visibleWithGap(search);await keyboard(page,874);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(before,0);
});
test('long modal corrects late native focus scrolling inside its own scroll layer',async({page})=>{
 const note=await openNote(page),body=page.locator('.sheet-body');await note.evaluate(e=>e.focus({preventScroll:true}));await keyboard(page,420);await visibleWithGap(note);
 // Safari may perform a second native focus scroll after the viewport resize.
 await page.waitForTimeout(650);await body.evaluate(e=>e.scrollTop=0);await visibleWithGap(note);
});
test('budget ignores non-scrolling wrapper and scrolls the modal body',async({page})=>{
 await page.goto('/');await page.locator('[data-action=budget]').click();await page.locator('#budget-form').evaluate(e=>{e.style.overflow='auto';});
 const input=page.locator('.budget-fields input').nth(6);await input.scrollIntoViewIfNeeded();await input.evaluate(e=>e.focus({preventScroll:true}));await keyboard(page,420);await visibleWithGap(input);
});
test('viewport may shrink before focus event is delivered to the modal',async({page})=>{
 const note=await openNote(page);await keyboard(page,420);await page.waitForTimeout(80);await note.evaluate(e=>e.focus({preventScroll:true}));await visibleWithGap(note);
});
test('short account dialog keeps opening balance visible without moving background page',async({page})=>{
 await page.goto('/');await page.locator('.bottom-nav [data-action=accounts]').click();await page.locator('[data-action=add-account]').first().click();const input=page.locator('#account-form [name=opening]');await input.evaluate(e=>e.focus({preventScroll:true}));const pageY=await page.evaluate(()=>scrollY);await keyboard(page,440,24);await visibleWithGap(input);await input.fill('200');await keyboard(page,874);await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(pageY);await expect(input).toHaveValue('200');
});
test('manual scrolling while keyboard is open is not pulled back to focused field',async({page})=>{
 const note=await openNote(page),body=page.locator('.sheet-body');await note.evaluate(e=>e.focus({preventScroll:true}));await keyboard(page,420);await visibleWithGap(note);await body.evaluate(e=>{e.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:-100}));e.scrollTop=0;});await page.waitForTimeout(400);expect(await body.evaluate(e=>e.scrollTop)).toBe(0);
});
test('budget footer stays outside scrolling form; row focus cannot create hidden nested scrolling',async({page})=>{
 await page.goto('/');await page.locator('[data-action=budget]').click();await expect(page.locator('#budget-form .budget-save-bar')).toHaveCount(0);await expect(page.locator('.sheet>.sheet-footer button')).toHaveAttribute('form','budget-form');
 const input=page.locator('.budget-fields input').nth(3);await input.scrollIntoViewIfNeeded();await input.evaluate(e=>e.focus({preventScroll:true}));await keyboard(page,420,40);await visibleWithGap(input);
 const result=await input.evaluate(e=>{const row=e.closest('.budget-swipe');row.scrollTop=40;const body=e.closest('.sheet-body').getBoundingClientRect(),footer=e.closest('.sheet').querySelector('.sheet-footer').getBoundingClientRect();return {rowTop:row.scrollTop,bodyBottom:body.bottom,footerTop:footer.top,footerBottom:footer.bottom};});
 expect(result.rowTop).toBe(0);expect(result.bodyBottom).toBeLessThanOrEqual(result.footerTop+1);expect(result.footerBottom).toBeLessThanOrEqual(461);
});
test('intermediate viewport bounce does not restore modal scroll before keyboard actually closes',async({page})=>{
 const note=await openNote(page),body=page.locator('.sheet-body');const before=await body.evaluate(e=>e.scrollTop);await note.evaluate(e=>e.focus({preventScroll:true}));await keyboard(page,420);await visibleWithGap(note);await keyboard(page,874);await page.waitForTimeout(250);await keyboard(page,420);await visibleWithGap(note);await page.waitForTimeout(300);await visibleWithGap(note);await note.blur();await keyboard(page,874);await expect.poll(()=>body.evaluate(e=>e.scrollTop)).toBeCloseTo(before,0);
});
test('opening and closing a sheet locks and restores underlying page position',async({page})=>{
 await page.goto('/');await page.evaluate(()=>scrollTo(0,180));const before=await page.evaluate(()=>scrollY);await page.locator('.bottom-nav [data-action=add]').click();expect(await page.evaluate(()=>getComputedStyle(document.body).position)).toBe('fixed');await page.locator('[data-action=close]').click();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(before);expect(await page.evaluate(()=>getComputedStyle(document.body).position)).not.toBe('fixed');
});
test('stable keyboard does not continuously measure the focused field',async({page})=>{
 const note=await openNote(page);await note.evaluate(e=>{window.fieldReads=0;const original=e.getBoundingClientRect.bind(e);e.getBoundingClientRect=()=>{window.fieldReads++;return original();};e.focus({preventScroll:true});});await keyboard(page,420);await visibleWithGap(note);await page.waitForTimeout(350);const start=await page.evaluate(()=>window.fieldReads);await page.waitForTimeout(650);expect(await page.evaluate(()=>window.fieldReads)-start).toBeLessThanOrEqual(2);
});
test('iPhone first tap uses preventScroll focus, preserves caret taps and ignores drags',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{get:()=> 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1'}));
 const note=await openNote(page);
 const result=await note.evaluate(el=>{const opts=[];const original=el.focus.bind(el);el.focus=o=>{opts.push(o);original(o);};function touch(type,x=100){const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[{clientX:x,clientY:400}]});el.dispatchEvent(e);return e.defaultPrevented;}
 touch('touchstart');const first=touch('touchend');touch('touchstart');const again=touch('touchend');el.blur();touch('touchstart');touch('touchmove',150);const drag=touch('touchend',150);return {opts,first,again,drag};});
 expect(result.opts).toEqual([{preventScroll:true}]);expect(result.first).toBe(true);expect(result.again).toBe(false);expect(result.drag).toBe(false);
});
test('keyboard animation batches field measurements until viewport settles',async({page})=>{
 const note=await openNote(page);await note.evaluate(e=>{window.animationReads=0;const original=e.getBoundingClientRect.bind(e);e.getBoundingClientRect=()=>{window.animationReads++;return original();};e.focus({preventScroll:true});});
 const during=await page.evaluate(async()=>{for(let i=1;i<=24;i++){window.testKeyboard(874-i*18);await new Promise(r=>setTimeout(r,16));}return window.animationReads;});expect(during).toBeLessThanOrEqual(1);
 await page.waitForTimeout(300);const settled=await page.evaluate(()=>window.animationReads);expect(settled).toBeLessThanOrEqual(3);await visibleWithGap(note);
});
