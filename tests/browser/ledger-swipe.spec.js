import {test,expect} from '@playwright/test';
import {initialState,today,shiftMonth,monthNow} from '../../src/model.js';
async function seed(page){
 const s=initialState();s.transactions=[['one',today(),1000,'第一笔'],['two',today(),2000,'第二笔'],['old',shiftMonth(monthNow(),-2)+'-01',3000,'历史记录']].map(([id,date,amount,note])=>({id,date,amount,note,type:'expense',categoryId:'e1',accountId:s.accounts[0].id}));
 await page.goto('/');await page.locator('[data-action=settings]').click();await page.locator('[data-action=backup]').click();await page.locator('#import-form [name=file]').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await page.locator('#import-form button').click();await page.locator('[data-action=confirm-import]').click();await page.locator('.bottom-nav [data-action=ledger]').click();
}
async function swipe(page,row,dx,dy=0){await row.scrollIntoViewIfNeeded();const b=await row.boundingBox(),x=b.x+b.width*.7,y=b.y+b.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();}
test('ledger swipe does not open editor, supports closing, vertical gestures and normal clicks',async({page})=>{
 await seed(page);const rows=page.locator('.ledger-swipe'),first=rows.first(),del=first.locator('.ledger-delete');
 await expect(del).toBeHidden();await swipe(page,first,-65);await expect(del).toBeVisible();await expect(page.locator('#tx-form')).toHaveCount(0);
 await swipe(page,first,65);await expect(del).toBeHidden();await expect(page.locator('#tx-form')).toHaveCount(0);
 await swipe(page,first,-2,35);await expect(del).toBeHidden();await expect(page.locator('#tx-form')).toHaveCount(0);
 await swipe(page,first,-65);await swipe(page,rows.nth(1),-65);await expect(del).toBeHidden();await expect(rows.nth(1).locator('.ledger-delete')).toBeVisible();
 await page.locator('#search').click();await expect(rows.nth(1).locator('.ledger-delete')).toBeHidden();await page.locator('#search').blur();
 await first.locator('.transaction').click();await expect(page.locator('#tx-form')).toBeVisible();await page.locator('[data-action=close]').click();
 await first.locator('.transaction').focus();await page.keyboard.press('ArrowLeft');await expect(del).toBeVisible();await page.keyboard.press('Escape');await expect(del).toBeHidden();
});
test('delete from filtered all-records list confirms, updates totals and persists without editing',async({page})=>{
 await seed(page);await page.locator('[data-action=ledger-all]').click();await page.locator('#search').fill('历史');const row=page.locator('.ledger-swipe');await swipe(page,row,-65);await row.locator('.ledger-delete').click();await expect(page.locator('#tx-form')).toHaveCount(0);await expect(page.getByRole('dialog')).toContainText('删除这笔账单');
 await page.locator('[data-action=close]').first().click();await expect(row).toHaveCount(1);await swipe(page,row,-65);await row.locator('.ledger-delete').click();await page.locator('[data-action=confirm-delete-tx]').click();
 await expect(row).toHaveCount(0);await expect(page.locator('#search')).toHaveValue('历史');await expect(page.locator('.all-period')).toHaveText('全部记录');await page.locator('[data-action=clear-search]').click();await expect(row).toHaveCount(2);await expect(page.locator('.ledger-summary')).toContainText('30.00');
 await page.reload();await page.locator('.bottom-nav [data-action=ledger]').click();await page.locator('[data-action=ledger-all]').click();await expect(page.locator('.ledger-swipe')).toHaveCount(2);await page.locator('.bottom-nav [data-action=home]').click();await expect(page.locator('.ledger-swipe')).toHaveCount(0);await expect(page.locator('.transaction')).toHaveCount(2);
});
test('real touch swipe reveals delete without navigating',async({page,context,browserName})=>{
 test.skip(browserName!=='chromium','CDP touch events require Chromium');await seed(page);const row=page.locator('.ledger-swipe').first();await row.scrollIntoViewIfNeeded();const b=await row.boundingBox(),x=b.x+b.width*.7,y=b.y+b.height/2,c=await context.newCDPSession(page);
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=6;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*12,y}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(row.locator('.ledger-delete')).toBeVisible();await expect(page.locator('#tx-form')).toHaveCount(0);await c.detach();
});
