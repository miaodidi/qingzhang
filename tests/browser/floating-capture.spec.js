import {test,expect} from '@playwright/test';
const floating=page=>page.locator('.floating-capture');
test.beforeEach(async({page})=>{await page.addInitScript(()=>{window.reads=0;Object.defineProperty(navigator,'clipboard',{value:{readText:async()=>{window.reads++;return '微信支付\n支付成功\n实付金额 12.30';}}});});await page.goto('/');});
test('floating action is on four tabs, preserves home entry, hides for all dialogs and settings',async({page})=>{
 await expect(page.locator('main [data-action=capture]')).toBeVisible();
 for(const tab of ['home','ledger','reports','accounts']){
  await page.locator(`.bottom-nav [data-action=${tab}]`).click();await expect(floating(page)).toBeVisible();
  await floating(page).click();await expect(page.locator('#tx-form [name=amount]')).toHaveValue('12.30');await expect(floating(page)).toBeHidden();await page.locator('[data-action=close]').click();await expect(floating(page)).toBeVisible();
 }
 expect(await page.evaluate(()=>window.reads)).toBe(4);
 await page.locator('.bottom-nav [data-action=add]').click();await expect(floating(page)).toBeHidden();await page.locator('[data-action=close]').click();await expect(floating(page)).toBeVisible();
 await page.locator('[data-action=add-account]').first().click();await expect(floating(page)).toBeHidden();await page.locator('[data-action=close]').click();await page.locator('[data-action=settings]').click();await expect(floating(page)).toBeHidden();
});
test('drag moves without reading, keeps position between tabs/reload, and stays above navigation',async({page})=>{
 const start=await floating(page).boundingBox(),nav=await page.locator('.bottom-nav').boundingBox();expect(start.y+start.height).toBeLessThan(nav.y);
 await page.mouse.move(start.x+35,start.y+30);await page.mouse.down();await page.mouse.move(start.x-140,start.y-190,{steps:12});await page.mouse.up();
 const moved=await floating(page).boundingBox();expect(moved.x).toBeLessThan(start.x-80);expect(moved.y).toBeLessThan(start.y-100);expect(await page.evaluate(()=>window.reads)).toBe(0);await expect(page.locator('[role=dialog]')).toHaveCount(0);
 await page.locator('.bottom-nav [data-action=reports]').click();const across=await floating(page).boundingBox();expect(across.x).toBeCloseTo(moved.x,0);expect(across.y).toBeCloseTo(moved.y,0);
 await page.reload();await expect(floating(page)).toBeVisible();const restored=await floating(page).boundingBox();expect(restored.x).toBeCloseTo(moved.x,0);expect(restored.y).toBeCloseTo(moved.y,0);
 await page.setViewportSize({width:320,height:600});await expect.poll(async()=>{const r=await floating(page).boundingBox(),n=await page.locator('.bottom-nav').boundingBox();return r.y+r.height<n.y;}).toBe(true);const small=await floating(page).boundingBox(),smallNav=await page.locator('.bottom-nav').boundingBox();expect(small.x).toBeGreaterThanOrEqual(0);expect(small.x+small.width).toBeLessThanOrEqual(320);expect(small.y+small.height).toBeLessThan(smallNav.y);
 await floating(page).click();await expect(page.locator('#tx-form')).toBeVisible();expect(await page.evaluate(()=>window.reads)).toBe(1);
});
test('touch pointer cancellation cannot trigger capture',async({page})=>{
 await floating(page).dispatchEvent('pointerdown',{pointerId:9,pointerType:'touch',button:0,clientX:300,clientY:650});await floating(page).dispatchEvent('pointercancel',{pointerId:9,pointerType:'touch'});await floating(page).dispatchEvent('click',{detail:1});expect(await page.evaluate(()=>window.reads)).toBe(0);await expect(page.locator('[role=dialog]')).toHaveCount(0);
});
