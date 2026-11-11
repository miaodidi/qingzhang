import {test,expect} from '@playwright/test';
import {initialState,today,monthNow,shiftMonth} from '../../src/model.js';
test.use({serviceWorkers:'block'});
const action=(page,name)=>page.locator(`[data-action="${name}"]:visible`).first().click();
function fixture(){
 const s=initialState();
 s.accounts=[{id:'daily',name:'日常账户',kind:'银行卡',opening:999000},{id:'wx',name:'微信',kind:'其他',opening:0},{id:'ali',name:'支付宝',kind:'支付宝',opening:0},{id:'bank',name:'我的银行卡',kind:'银行卡',opening:0}];
 return s;
}
async function importState(page,s){
 await page.goto('/');await action(page,'settings');await action(page,'backup');
 await page.locator('#import-form [name=file]').setInputFiles({name:'accounts-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
 await page.locator('#import-form button').click();await action(page,'confirm-import');await action(page,'home');
}
async function clipboard(page){
 await page.addInitScript(()=>{window.testReceipt='';Object.defineProperty(navigator,'clipboard',{value:{readText:async()=>window.testReceipt}});});
}
async function capture(page,text){await page.evaluate(text=>window.testReceipt=text,text);await page.getByRole('button',{name:'截图记账（可拖动）',exact:true}).click();await expect(page.locator('#tx-form')).toBeVisible();}
test('capture matches current accounts, allows override, saves the chosen account and respects renaming',async({page})=>{
 await clipboard(page);await importState(page,fixture());
 await capture(page,'微信支付\n支付成功\n实付金额 18.00\n'+today());
 await expect(page.locator('[name=accountId]')).toHaveValue('wx');
 await page.locator('[name=accountId]').selectOption('bank');await page.getByRole('button',{name:'保存账单',exact:true}).click();
 await action(page,'ledger');await expect(page.locator('.transaction')).toContainText('我的银行卡');
 await capture(page,'支付方式：支付宝\n实付 34.56\n'+today());await expect(page.locator('[name=accountId]')).toHaveValue('ali');await action(page,'close');
 await capture(page,'实付 12.00\n'+today());await expect(page.locator('[name=accountId]')).toHaveValue('daily');await action(page,'close');
 await action(page,'accounts');await page.locator('[data-action=edit-account][data-id=wx]').click();await page.locator('#account-form [name=name]').fill('备用钱包');await page.getByRole('button',{name:'保存账户',exact:true}).click();
 await capture(page,'微信支付\n实付 19.00\n'+today());await expect(page.locator('[name=accountId]')).toHaveValue('daily');
});
test('AI amount/category enhancement retains payment account matching',async({page})=>{
 await clipboard(page);await importState(page,fixture());
 await page.evaluate(()=>localStorage.setItem('qingzhang.deepseek.v1',JSON.stringify({enabled:true,key:'sk-test-key-not-real'})));
 await page.route('https://api.deepseek.com/chat/completions',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({amountCandidates:[34.56],categoryId:'e1',confidence:'high',merchant:'测试店',product:'手机壳'})}}]})}));
 await capture(page,'支付方式：支付宝\n实付 34.56\n'+today());await expect(page.locator('[name=accountId]')).toHaveValue('ali');await expect(page.locator('[name=amount]')).toHaveValue('34.56');await expect(page.locator('#modal-root')).toContainText('DeepSeek 已辅助识别');
});
test('account picker filters alongside search and date; account spending follows month/year and excludes transfers',async({page})=>{
 const s=fixture(),month=monthNow(),other=month.endsWith('-01')?month.slice(0,4)+'-02':shiftMonth(month,-1);
 const tx=(id,accountId,amount,date=month+'-01',type='expense')=>({id,accountId,amount,date,type,note:'测试消费',categoryId:type==='income'?'i0':'e0'});
 s.transactions=[tx('w1','wx',1590),tx('w2','wx',410),tx('a1','ali',1000),tx('past','ali',3000,other+'-01'),tx('prior-year','wx',99000,(Number(month.slice(0,4))-1)+'-01-01'),tx('income','wx',50000,month+'-01','income'),{...tx('transfer','wx',80000,month+'-01','transfer'),toAccountId:'ali'}];
 await importState(page,s);await action(page,'ledger');
 const picker=page.getByRole('combobox',{name:'筛选账户'});await expect(picker).toHaveCount(1);await expect(page.locator('.account-filter-button')).toBeVisible();
 await picker.selectOption('ali');await page.locator('[data-action=filter][data-value=expense]').click();await page.locator('#search').fill('测试消费');await expect(page.locator('.transaction')).toHaveCount(1);await expect(page.locator('.ledger-summary')).toContainText('10.00');
 await action(page,'ledger-all');await expect(page.locator('.transaction')).toHaveCount(2);await expect(picker).toHaveValue('ali');await picker.selectOption('');await expect(page.locator('.transaction')).toHaveCount(5);
 await action(page,'reports');const card=page.getByRole('region',{name:'账户支出分析'}),row=id=>card.locator(`[data-account-id=${id}]`);
 await expect(card.locator('.account-spending-row')).toHaveCount(4);await expect(row('wx')).toContainText('20.00');await expect(row('wx')).toContainText('2 笔支出');await expect(row('wx')).toContainText('66.7%');await expect(row('ali')).toContainText('10.00');await expect(row('bank')).toContainText('0.00');
 await page.locator('[data-action=period][data-value=year]').click();await expect(row('ali')).toContainText('40.00');await expect(card.locator('.account-spending-row').first()).toHaveAttribute('data-account-id','ali');await expect(row('wx')).toContainText('20.00');
 await page.locator('[data-action=period][data-value=month]').click();await page.locator('#month-input').fill(other);await expect(row('ali')).toContainText('30.00');await expect(row('wx')).toContainText('0.00');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
