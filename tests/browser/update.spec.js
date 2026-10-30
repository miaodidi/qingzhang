import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>{
 window.updateCalls=0;window.updateMode='none';const reg=new EventTarget();reg.waiting=null;reg.installing=null;window.testRegistration=reg;
 reg.update=async()=>{window.updateCalls++;if(window.updateMode==='fail')throw Error('offline');if(window.updateMode==='new'){const w=new EventTarget();w.state='installing';w.postMessage=message=>{window.updateMessage=message;};reg.installing=w;reg.dispatchEvent(new Event('updatefound'));setTimeout(()=>{reg.waiting=w;reg.installing=null;w.state='installed';w.dispatchEvent(new Event('statechange'));},80);}return reg;};
 const sw=new EventTarget();sw.controller={};sw.register=async(url,options)=>{window.registrationOptions=options;return reg;};Object.defineProperty(navigator,'serviceWorker',{value:sw});
 });await page.goto('/');});
test('every settings visit checks network; downloaded update appears without restart',async({page})=>{
 const settings=page.locator('[data-action=settings]');await settings.click();await expect(page.locator('.update-status')).toHaveText('已检查，当前是最新版本');expect(await page.evaluate(()=>window.updateCalls)).toBe(1);expect(await page.evaluate(()=>window.registrationOptions.updateViaCache)).toBe('none');
 await page.locator('.bottom-nav [data-action=reports]').click();await page.evaluate(()=>window.updateMode='new');await settings.click();await expect(page.locator('[data-action=update]')).toBeVisible();expect(await page.evaluate(()=>window.updateCalls)).toBe(2);
 await page.locator('[data-action=update]').click();expect(await page.evaluate(()=>window.updateMessage)).toEqual({type:'SKIP_WAITING'});
});
test('failed check does not block settings and next click retries',async({page})=>{
 await page.evaluate(()=>window.updateMode='fail');await page.locator('[data-action=settings]').click();await expect(page.locator('.update-status')).toContainText('暂时无法检查');await expect(page.locator('[data-action=backup]')).toBeVisible();await page.evaluate(()=>window.updateMode='none');await page.locator('[data-action=settings]').click();await expect(page.locator('.update-status')).toHaveText('已检查，当前是最新版本');expect(await page.evaluate(()=>window.updateCalls)).toBe(2);
});
test('an old page offers reload when the active offline version is newer',async({page})=>{
 await page.evaluate(()=>{window.testRegistration.active={postMessage:(_,ports)=>ports[0].postMessage({version:'future-test-version'})};});
 await page.locator('[data-action=settings]').click();
 await expect(page.locator('.update-status')).toContainText('加载新页面');await expect(page.locator('[data-action=update]')).toBeVisible();
});
