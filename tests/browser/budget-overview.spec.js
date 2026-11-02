import {test,expect} from '@playwright/test';
import {initialState,monthNow,shiftMonth} from '../../src/model.js';
for(const count of [0,2,12])test(`budget overview with ${count} active categories`,async({page})=>{
 const s=initialState(),month=monthNow(),cats=s.categories.filter(c=>c.type==='expense');
 while(cats.length<14){const c={id:'extra'+cats.length,name:'分类'+cats.length,type:'expense'};cats.push(c);s.categories.push(c);}
 s.transactions=cats.slice(0,count).map((c,i)=>({id:'t'+i,date:month+'-01',amount:(i+1)*100,categoryId:c.id,type:'expense',note:'测试',accountId:s.accounts[0].id}));
 s.transactions.push({id:'old',date:shiftMonth(month,-1)+'-01',amount:9900,categoryId:cats[13].id,type:'expense',note:'测试',accountId:s.accounts[0].id});
 s.budgets[month]={total:50000,categories:{[cats[0].id]:50}};
 await page.goto('/');await page.locator('[data-action=settings]').click();await page.locator('[data-action=backup]').click();await page.locator('#import-form [name=file]').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await page.locator('#import-form button').click();await page.locator('[data-action=confirm-import]').click();
 await page.locator('.bottom-nav [data-action=reports]').click();await expect(page.locator('[data-action=budget]')).toHaveCount(0);await page.locator('[data-action=budget-overview]').click();await expect(page.locator('#budget-overview input')).toHaveCount(0);await expect(page.locator('#budget-overview-list .budget-item')).toHaveCount(5);await expect(page.locator('#budget-overview-list .budget-meter')).toHaveCount(5);
 if(count>5){await page.locator('[data-action=budget-more]').click();await expect(page.locator('#budget-overview-list .budget-item')).toHaveCount(10);await page.locator('[data-action=budget-more]').click();await expect(page.locator('#budget-overview-list .budget-item')).toHaveCount(12);await expect(page.locator('[data-action=budget-more]')).toContainText('收起');await expect(page.locator('#budget-overview-list')).not.toContainText(cats[13].name);await expect(page.locator('#budget-overview-list')).toContainText('超支');await page.locator('[data-action=budget-more]').click();await expect(page.locator('#budget-overview-list .budget-item')).toHaveCount(5);}else{await expect(page.locator('[data-action=budget-more]')).toBeDisabled();}
 await expect.poll(()=>page.locator('.sheet-body').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBeTruthy();
 await page.locator('[data-action=close]').click();await page.locator('.bottom-nav [data-action=home]').click();await page.locator('[data-action=budget]').click();await expect(page.locator('#budget-form [name=total]')).toHaveValue('500');await expect(page.locator('#budget-form [name=cat-'+cats[0].id+']')).toHaveValue('0.5');
});
