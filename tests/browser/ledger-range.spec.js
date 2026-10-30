import {test,expect} from '@playwright/test';
import {initialState,monthNow,shiftMonth} from '../../src/model.js';
test('all records search, month boundaries and shortcuts preserve the active search and filters',async({page})=>{
 const s=initialState(),current=monthNow(),old=shiftMonth(current,-24);
 s.transactions=[['now',current,'奶茶',500,'expense','e0'],['old',old,'奶茶',600,'expense','e0'],['income',old,'奶茶退款',100,'income','i0'],['other',current,'地铁',200,'expense','e2']].map(([id,m,note,amount,type,categoryId])=>({id,date:m+'-01',note,amount,type,categoryId,accountId:s.accounts[0].id}));
 await page.goto('/');await page.locator('[data-action=settings]').click();await page.locator('[data-action=backup]').click();await page.locator('#import-form [name=file]').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await page.locator('#import-form button').click();await page.locator('[data-action=confirm-import]').click();await page.locator('.bottom-nav [data-action=ledger]').click();
 await expect(page.locator('#month-input')).toHaveAttribute('max',current);
 await page.locator('#search').fill('奶茶');await expect(page.locator('.transaction')).toHaveCount(1);
 await page.locator('[data-action=next-month]').click();await expect(page.locator('.all-period')).toHaveText('全部记录');await expect(page.locator('[data-action=next-month]')).toBeDisabled();await expect(page.locator('.transaction')).toHaveCount(3);await expect(page.locator('.ledger-summary')).toContainText('11.00');await expect(page.locator('.day-label').last()).toContainText(old.slice(0,4)+'年');
 await page.locator('[data-action=filter][data-value=expense]').click();await expect(page.locator('.transaction')).toHaveCount(2);
 await page.locator('[data-action=prev-month]').click();await expect(page.locator('#month-input')).toHaveValue(current);await expect(page.locator('#search')).toHaveValue('奶茶');await expect(page.locator('.transaction')).toHaveCount(1);
 await page.locator('#month-input').fill(old);await expect(page.locator('.transaction')).toHaveCount(1);
 await page.locator('[data-action=ledger-current]').click();await expect(page.locator('#month-input')).toHaveValue(current);
 await page.locator('#month-input').fill(old);await page.locator('[data-action=ledger-all]').click();await expect(page.locator('.transaction')).toHaveCount(2);
 await page.locator('[data-action=clear-search]').click();await expect(page.locator('.transaction')).toHaveCount(3);await expect(page.locator('.all-period')).toHaveText('全部记录');
 await page.locator('.bottom-nav [data-action=reports]').click();await expect(page.locator('#month-input')).toHaveValue(current);await expect(page.locator('[data-action=ledger-all]')).toHaveCount(0);
});
