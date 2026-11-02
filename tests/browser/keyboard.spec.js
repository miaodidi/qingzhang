import {test,expect} from '@playwright/test';
// Mobile browser emulation has no OS keyboard. Change only the visual viewport,
// as Safari does, while retaining the real page/sheet layout and scrolling.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{
 const v=new EventTarget();Object.assign(v,{height:874,width:402,offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(window,'visualViewport',{get:()=>v});
 window.testKeyboard=(height,offsetTop=0)=>{v.height=height;v.offsetTop=offsetTop;v.dispatchEvent(new Event('resize'));v.dispatchEvent(new Event('scroll'));};
 });});
async function keyboard(page,h,offset=0){await page.evaluate(([h,o])=>window.testKeyboard(h,o),[h,offset]);}
async function openNote(page){await page.goto('/');await page.locator('.bottom-nav [data-action=add]').click();const note=page.locator('#tx-form [name=note]');await note.scrollIntoViewIfNeeded();await page.locator('.sheet').evaluate(el=>el.getAnimations().forEach(a=>a.finish()));return note;}
async function bounds(field){return field.evaluate(el=>{const r=el.getBoundingClientRect(),s=el.closest('.sheet-body'),b=s?.getBoundingClientRect(),f=s?.querySelector('.budget-save-bar')?.getBoundingClientRect(),v=visualViewport;return {top:r.top,bottom:r.bottom,min:Math.max(v.offsetTop+24,b?b.top+24:0),max:Math.min(v.offsetTop+v.height-24,b?b.bottom-24:Infinity,f?f.top-24:Infinity)};});}
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
