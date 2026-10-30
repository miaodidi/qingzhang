import {test,expect} from '@playwright/test';
async function action(page,name){await page.locator(`[data-action="${name}"]:visible`).first().click();}
async function generate(page,password=''){await action(page,'backup');await page.locator('#backup-form [name=password]').fill(password);await page.locator('#backup-form [name=confirm]').fill(password);await page.locator('#backup-form button').click();await expect(page.locator('#backup-ready')).toContainText('备份文件已生成');}
test('share sends one JSON file without extra text, blocks duplicate taps and preserves naming preference',async({page})=>{
 await page.addInitScript(()=>{window.shares=[];Object.defineProperty(navigator,'canShare',{value:()=>true});Object.defineProperty(navigator,'share',{value:async data=>{window.shares.push({keys:Object.keys(data),names:data.files.map(f=>f.name),content:await data.files[0].text()});await new Promise(r=>window.finishShare=r);}});});
 await page.goto('/');await action(page,'settings');await expect(page.locator('[data-action="replace-backup"]')).toHaveAttribute('aria-pressed','true');
 await generate(page);await page.evaluate(()=>{const b=document.querySelector('[data-action="share-backup"]');b.click();b.click();});
 await expect.poll(()=>page.evaluate(()=>window.shares.length)).toBe(1);
 let first=await page.evaluate(()=>window.shares[0]);expect(first.keys).toEqual(['files']);expect(first.names).toEqual(['轻账-最新备份.json']);expect(JSON.parse(first.content).version).toBe(1);
 await expect(page.locator('[data-action="download-backup"]')).toBeDisabled();await page.evaluate(()=>window.finishShare());await expect(page.locator('[data-action="share-backup"]')).toBeEnabled();await action(page,'close');
 await generate(page,'password-123');await action(page,'share-backup');await expect.poll(()=>page.evaluate(()=>window.shares.length)).toBe(2);let second=await page.evaluate(()=>window.shares[1]);expect(second.keys).toEqual(['files']);expect(second.names).toEqual(first.names);expect(JSON.parse(second.content).format).toBe('qingzhang-encrypted');await page.evaluate(()=>window.finishShare());await expect(page.locator('[data-action="share-backup"]')).toBeEnabled();await action(page,'close');
 await action(page,'replace-backup');await expect(page.locator('[data-action="replace-backup"]')).toHaveAttribute('aria-pressed','false');await page.reload();await action(page,'settings');await expect(page.locator('[data-action="replace-backup"]')).toHaveAttribute('aria-pressed','false');await generate(page);const download=page.waitForEvent('download');await action(page,'download-backup');expect((await download).suggestedFilename()).toMatch(/^轻账-备份-\d{4}-\d{2}-\d{2}-\d{6}\.json$/);
});
test('cancelling file sharing never marks a backup complete or silently downloads',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'canShare',{value:()=>true});Object.defineProperty(navigator,'share',{value:()=>Promise.reject(new DOMException('Cancelled','AbortError'))});});
 let downloads=0;page.on('download',()=>downloads++);await page.goto('/');await generate(page);await action(page,'share-backup');await expect(page.locator('[data-action="share-backup"]')).toBeEnabled();await expect(page.locator('.backup-status')).toContainText('还没有导出过备份');expect(downloads).toBe(0);
});
