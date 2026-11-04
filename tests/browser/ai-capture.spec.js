import {test,expect} from '@playwright/test';
import {today} from '../../src/model.js';
// Route API fixtures before a service worker can take ownership of requests.
test.use({serviceWorkers:'block'});
const key='sk-not-a-real-key-for-tests';
const storageKey='qingzhang.deepseek.v1';
const endpoint='https://api.deepseek.com/chat/completions';
const receipt='此剪切板记录为轻账专用\n支付宝\n账单详情\n测试饺子馆\n-15.90\n交易成功\n订单金额\n16.00\n碰一下立减\n-0.10\n支付时间\n'+today()+' 12:00:00\n收款方全称\n测试饺子馆分店\n商品名称\n卤蛋面';
const answer={amountCandidates:[15.9],categoryId:'e0',confidence:'high',merchant:'测试饺子馆',product:'卤蛋面'};
const payload=value=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});
async function action(page,name){await page.locator(`[data-action="${name}"]:visible`).first().click();}
async function setup(page,enabled=true,text=receipt){
 await page.addInitScript(({enabled,key,storageKey,receipt})=>{
  if(!localStorage.getItem('ai-test-initialized')){localStorage.setItem(storageKey,JSON.stringify({enabled,key}));localStorage.setItem('ai-test-initialized','1');}
  Object.defineProperty(navigator,'clipboard',{value:{readText:async()=>receipt}});
 },{enabled,key,storageKey,receipt:text});
}
test('AI enhances one click capture, preserves net amount, custom catalog, confirmation and dedup',async({page})=>{
 await setup(page);let calls=0;
 await page.route(endpoint,async route=>{calls++;const req=route.request().postDataJSON();expect(req.model).toBe('deepseek-flash');expect(req.thinking.type).toBe('disabled');expect(req.response_format.type).toBe('json_object');expect(JSON.parse(req.messages[1].content).categories).toContainEqual({id:'e0',name:'餐饮'});await route.fulfill({contentType:'application/json',body:payload({...answer,amount:1600})});});
 await page.goto('/');await action(page,'capture');await expect(page.locator('#tx-form [name=note]')).toHaveValue('测试饺子馆 · 卤蛋面');await expect(page.locator('#tx-form [name=amount]')).toHaveValue('15.90');await expect(page.locator('#tx-form [name=categoryId]:checked')).toHaveValue('e0');await expect(page.locator('#modal-root')).toContainText('DeepSeek 已辅助识别');await expect(page.locator('.hero-amount')).toContainText('0.00');
 await page.locator('.tx-save-bar button').click();await action(page,'capture');await expect(page.locator('#capture-form .form-error')).toContainText('已经入账');expect(calls).toBe(1);
});
test('network failure falls back with reason, disabling AI makes zero requests',async({page})=>{
 await setup(page);let calls=0;await page.route(endpoint,async route=>{calls++;await route.fulfill({status:402,contentType:'application/json',body:'{"error":"private error body"}'});});
 await page.goto('/');await action(page,'capture');await expect(page.locator('#tx-form [name=note]')).toHaveValue('测试饺子馆分店');await expect(page.locator('#modal-root')).toContainText('余额不足');await expect(page.locator('#modal-root')).not.toContainText('private error body');await action(page,'close');
 await action(page,'settings');await action(page,'ai-settings');await page.locator('[name=enabled]').selectOption('false');await page.locator('#ai-settings-form [value=save]').click();await action(page,'home');await action(page,'capture');await expect(page.locator('#tx-form [name=amount]')).toHaveValue('15.90');expect(calls).toBe(1);
});
test('dismissed AI request never replaces new draft; local fallback cancels waiting',async({page})=>{
 await setup(page);let calls=0;const routes=[];await page.route(endpoint,route=>{calls++;routes.push(route);});
 await page.goto('/');await action(page,'capture');await expect(page.locator('#capture-ai-progress')).toBeVisible();await page.locator('#capture-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await expect.poll(()=>calls).toBe(1);
 await action(page,'close');await action(page,'add');await page.locator('#tx-form [name=note]').fill('保留我的手写草稿');await routes[0].fulfill({contentType:'application/json',body:payload(answer)}).catch(()=>{});await expect(page.locator('#tx-form [name=note]')).toHaveValue('保留我的手写草稿');await action(page,'close');
 await action(page,'capture');await expect(page.locator('#capture-ai-progress')).toBeVisible();await action(page,'capture-local');await expect(page.locator('#tx-form [name=amount]')).toHaveValue('15.90');await expect(page.locator('#modal-root')).toContainText('已跳过 AI');await routes[1]?.abort().catch(()=>{});
});
test('settings test uses fictional receipt, keeps secret out of form and backups, remove persists',async({page})=>{
 await setup(page,false);await page.route(endpoint,async route=>{const req=route.request().postDataJSON();expect(req.messages[1].content).toContain('测试面馆');expect(req.messages[1].content).not.toContain('测试饺子馆');await route.fulfill({contentType:'application/json',body:payload({categoryId:'test-dining',confidence:'high',merchant:'测试面馆',product:'牛肉面'})});});
 await page.goto('/');await page.evaluate(k=>localStorage.removeItem(k),storageKey);await action(page,'settings');await action(page,'ai-settings');await expect(page.locator('[name=apiKey]')).toHaveValue('');await page.locator('[name=apiKey]').fill(key);await expect(page.locator('[name=apiKey]')).toHaveAttribute('type','password');await page.locator('[name=enabled]').selectOption('true');await page.locator('#ai-settings-form [value=test]').click();await expect(page.locator('#ai-settings-form')).toHaveCount(0);await expect(page.locator('[data-action=ai-settings]')).toContainText('已开启');
 await action(page,'backup');await page.locator('#backup-form button').click();await expect(page.locator('#backup-ready')).toContainText('备份文件已生成');const download=page.waitForEvent('download');await action(page,'download-backup');const file=await download;const stream=await file.createReadStream();let text='';for await(const part of stream)text+=part;expect(text).not.toContain(key);expect(text).not.toContain(storageKey);await action(page,'close');
 await action(page,'ai-settings');await action(page,'ai-clear');expect(await page.evaluate(k=>localStorage.getItem(k),storageKey)).toBeNull();await action(page,'close');await page.reload();await action(page,'settings');await expect(page.locator('[data-action=ai-settings]')).toContainText('使用你自己的密钥');
});
test('new user category is sent and selected alongside AI payment amount',async({page})=>{
 await setup(page);let customId;
 await page.route(endpoint,async route=>{const data=JSON.parse(route.request().postDataJSON().messages[1].content);const custom=data.categories.find(c=>c.name==='我的面食');expect(custom).toBeTruthy();customId=custom.id;await route.fulfill({contentType:'application/json',body:payload({...answer,categoryId:custom.id})});});
 await page.goto('/');await action(page,'add');await action(page,'toggle-categories');await page.locator('[data-category-action=edit]').click();await page.locator('[data-category-action=add]').click();await page.locator('#new-category-name').fill('我的面食');await page.locator('[data-category-action=create]').click();await expect(page.locator('.category-choice small').last()).toHaveText('我的面食');await action(page,'close');await action(page,'capture');await expect(page.locator('#tx-form [name=note]')).toHaveValue('测试饺子馆 · 卤蛋面');await expect(page.locator('[name=categoryId]:checked')).toHaveValue(customId);await expect(page.locator('#tx-form [name=amount]')).toHaveValue('15.90');
});
test('offline mode skips model without changing saved configuration',async({page,context})=>{
 await setup(page);let calls=0;await page.route(endpoint,route=>{calls++;return route.abort();});await page.goto('/');await expect(page.locator('.hero-amount')).toBeVisible();await context.setOffline(true);await action(page,'capture');await expect(page.locator('#tx-form [name=amount]')).toHaveValue('15.90');await expect(page.locator('#modal-root')).toContainText('当前离线');expect(calls).toBe(0);expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).enabled,storageKey)).toBe(true);
});

test('ranked AI amounts select first, allow switching and manual editing, save the selected amount',async({page})=>{
 await setup(page,true,'支付成功\n商户名称：测试饺子馆\n实付金额 19.90\n实付金额 20.00\n'+today());
 await page.route(endpoint,route=>route.fulfill({contentType:'application/json',body:payload({...answer,product:'',amountCandidates:[20,19.9]})}));
 await page.goto('/');await action(page,'capture');const form=page.locator('#tx-form'),buttons=page.locator('.capture-candidates button');
 await expect(form.locator('[name=amount]')).toHaveValue('20.00');await expect(buttons).toHaveCount(2);await expect(buttons.first()).toHaveAttribute('aria-pressed','true');await expect(page.locator('#modal-root')).toContainText('多个可能的实际收付金额');
 await buttons.nth(1).click();await expect(form.locator('[name=amount]')).toHaveValue('19.90');await expect(buttons.first()).toHaveAttribute('aria-pressed','false');await expect(buttons.nth(1)).toHaveAttribute('aria-pressed','true');
 await form.locator('[name=amount]').fill('18.00');await expect(page.locator('.capture-candidates [aria-pressed=true]')).toHaveCount(0);
 await buttons.first().click();await page.locator('.tx-save-bar button').click();await expect(page.locator('#tx-form')).toHaveCount(0);await action(page,'ledger');await expect(page.locator('.tx-amount').first()).toContainText('20.00');
});
test('single AI amount removes local alternatives; empty AI amount retains local candidates and AI note',async({page})=>{
 await setup(page);let calls=0;await page.route(endpoint,route=>route.fulfill({contentType:'application/json',body:payload({...answer,amountCandidates:++calls===1?[15.9]:[]})}));
 await page.goto('/');await action(page,'capture');await expect(page.locator('#tx-form [name=amount]')).toHaveValue('15.90');await expect(page.locator('.capture-candidates')).toHaveCount(0);await expect(page.locator('#modal-root')).not.toContainText('识别到多个金额');
 await action(page,'close');await action(page,'capture');await expect(page.locator('#tx-form [name=amount]')).toHaveValue('15.90');await expect(page.locator('#tx-form [name=note]')).toHaveValue('测试饺子馆 · 卤蛋面');await expect(page.locator('.capture-candidates button').first()).toHaveAttribute('aria-pressed','true');await expect(page.locator('#modal-root')).toContainText('已使用本地金额识别结果');
});
test('both recognizers find no amount: keep field blank, require user amount, retain AI note/category',async({page})=>{
 await setup(page,true,'支付成功\n商户名称：测试饺子馆\n商品名称：卤蛋面\n'+today());
 await page.route(endpoint,route=>route.fulfill({contentType:'application/json',body:payload({...answer,amountCandidates:[]})}));
 await page.goto('/');await action(page,'capture');await expect(page.locator('#tx-form [name=amount]')).toHaveValue('');await expect(page.locator('#tx-form [name=note]')).toHaveValue('测试饺子馆 · 卤蛋面');await expect(page.locator('#tx-form [name=categoryId]:checked')).toHaveValue('e0');await expect(page.locator('#modal-root')).toContainText('请手动填写');
 await page.locator('.tx-save-bar button').click();await expect(page.locator('#tx-form')).toBeVisible();await page.locator('#tx-form [name=amount]').fill('18.00');await page.locator('.tx-save-bar button').click();await expect(page.locator('#tx-form')).toHaveCount(0);
});

test('shopping order selected category stays visible while collapsed and preserves custom catalog order',async({page})=>{
 await setup(page,true,'打包中 快递即将发出\n订单确认，已通知商家配货\n测试配件店\n透明磁吸手机壳\n发货前可快速退款\n7天无理由退货\n申请退款\n实付：¥34.56（免运费）\n支付方式：支付宝\n'+today());
 let digitalId;
 await page.route(endpoint,route=>{
  const data=JSON.parse(route.request().postDataJSON().messages[1].content);digitalId=data.categories.find(c=>c.name==='数码').id;
  return route.fulfill({contentType:'application/json',body:payload({amountCandidates:[34.56],categoryId:digitalId,confidence:'high',merchant:'测试配件店',product:'透明磁吸手机壳'})});
 });
 await page.goto('/');await action(page,'capture');
 await expect(page.locator('#tx-form [name=amount]')).toHaveValue('34.56');await expect(page.locator('#tx-form [name=categoryId]:checked')).toHaveValue(digitalId);
 const selected=page.locator('.category-choice').filter({hasText:'数码'});
 await expect(selected).toBeVisible();await expect(page.locator('.category-choice:visible')).toHaveCount(9);await expect(page.locator('.category-choice:visible').nth(8).locator('small')).toHaveText('数码');await expect(page.locator('#modal-root')).not.toContainText('退款是否到账');
 await action(page,'toggle-categories');const fullOrder=await page.locator('.category-choice').evaluateAll(items=>items.map(i=>i.dataset.id));expect(fullOrder.indexOf(digitalId)).toBeGreaterThan(8);
 await action(page,'toggle-categories');await expect(selected).toBeVisible();
 await page.locator('.tx-save-bar button').click();await page.locator('.transaction').first().click();await expect(selected).toBeVisible();await expect(page.locator('[name=categoryId]:checked')).toHaveValue(digitalId);
 await page.locator('.category-choice').filter({hasText:'购物'}).click();await expect(page.locator('[name=categoryId]:checked')).toHaveValue('e1');await page.locator('.tx-save-bar button').click();await expect(page.locator('.transaction').first()).toContainText('购物');
});
