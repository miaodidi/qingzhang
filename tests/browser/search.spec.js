import {test,expect} from '@playwright/test';
import {initialState,today} from '../../src/model.js';
test.beforeEach(async({page})=>{
 const s=initialState();s.transactions=[['a','午饭 noodles',1234,'e0'],['b','公交',200,'e2'],['c','午饭 rice',1800,'e0']].map(([id,note,amount,categoryId])=>({id,note,amount,categoryId,type:'expense',date:today(),accountId:s.accounts[0].id}));
 await page.goto('/');await page.locator('[data-action=settings]').click();await page.locator('[data-action=backup]').click();
 await page.locator('#import-form [name=file]').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await page.locator('#import-form button').click();await page.locator('[data-action=confirm-import]').click();await page.locator('.bottom-nav [data-action=ledger]').click();
 await page.locator('#search').focus();await page.evaluate(()=>window.originalSearch=document.querySelector('#search'));
});
test('continuous typing, middle edits and clearing keep the same focused input',async({page})=>{
 const input=page.locator('#search');await expect(page.getByRole('button',{name:'清空搜索'})).toBeHidden();await input.pressSequentially('noodles');await expect(input).toHaveValue('noodles');await expect(page.locator('.transaction')).toHaveCount(1);
 expect(await page.evaluate(()=>document.querySelector('#search')===window.originalSearch&&document.activeElement===window.originalSearch)).toBe(true);
 await input.evaluate(el=>el.setSelectionRange(2,4));await input.press('Backspace');await expect(input).toHaveValue('noles');await expect(page.locator('#ledger-results')).toContainText('没有找到记录');
 expect(await input.evaluate(el=>el.selectionStart)).toBe(2);
 await page.getByRole('button',{name:'清空搜索'}).click();await expect(input).toHaveValue('');await expect(input).toBeFocused();await expect(page.getByRole('button',{name:'清空搜索'})).toBeHidden();await expect(page.locator('.transaction')).toHaveCount(3);await expect(page.locator('#ledger-count')).toHaveText('3 笔');
 await input.fill('12.34');await expect(page.locator('.transaction')).toHaveCount(1);await expect(page.locator('.ledger-summary')).toContainText('12.34');
 await input.fill('餐饮');await expect(page.locator('.transaction')).toHaveCount(2);
});
test('Chinese composition is not interrupted and filters after committing the word',async({page})=>{
 await page.locator('#search').evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.value='wu';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'wu'}));});
 await expect(page.locator('.transaction')).toHaveCount(3);expect(await page.evaluate(()=>document.activeElement===window.originalSearch)).toBe(true);
 await page.locator('#search').evaluate(el=>{el.value='午饭';el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'午饭'}));el.dispatchEvent(new InputEvent('input',{bubbles:true,data:'午饭'}));});
 await expect(page.locator('#search')).toHaveValue('午饭');await expect(page.locator('.transaction')).toHaveCount(2);
 expect(await page.evaluate(()=>document.querySelector('#search')===window.originalSearch&&document.activeElement===window.originalSearch)).toBe(true);
 await page.locator('#search').evaluate(el=>{el.value='';el.dispatchEvent(new Event('search',{bubbles:true}));});await expect(page.locator('.transaction')).toHaveCount(3);
});
