import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePaymentText} from '../src/capture.js';
import {initialState} from '../src/model.js';
import {encodeBackup} from '../src/store.js';
import {AI_MODEL,AI_STORAGE_KEY,prepareAIText,buildAIRequest,applyAIResult,requestAI,readAIConfig,saveAIConfig,clearAIConfig} from '../src/ai-capture.js';
const receipt='账单详情\n饺子馆刀削面家常菜\n-15.90\n交易成功\n订单金额\n16.00\n碰一下立减\n-0.10\n支付时间\n2026-10-28 18:08:24\n付款方式\n工商银行储蓄卡（8903）\n收单机构\n拉卡拉支付股份有限公司\n清算机构\n中国银联股份有限公司\n收款方全称\n饺子刀削面家常菜北京王庄店\n卤蛋面\n订单号\n1234567890123456789\n手机号：13800138000';
const local=parsePaymentText(receipt,'2026-11-03');
const categories=[{id:'custom-noodles',name:'吃面',type:'expense'},{id:'salary',name:'工资',type:'income'}];
const good={amountCandidates:[15.9],categoryId:'custom-noodles',confidence:'high',merchant:'饺子馆刀削面家常菜',product:'卤蛋面'};
const key='sk-not-a-real-key-for-tests';
const response=(value=good,finish_reason='stop')=>({ok:true,json:async()=>({choices:[{finish_reason,message:{content:JSON.stringify(value)}}]})});
test('AI uses current custom categories, bounded non-thinking JSON and redacts identifiers',()=>{
 const body=buildAIRequest(local,categories),data=JSON.parse(body.messages[1].content);
 assert.equal(body.model,AI_MODEL);assert.deepEqual(body.thinking,{type:'disabled'});assert.equal(body.response_format.type,'json_object');assert.equal(body.max_tokens,500);
 assert.deepEqual(data.categories,[{id:'custom-noodles',name:'吃面'}]);assert.equal(data.type,'expense');
 for(const secret of ['8903','1234567890123456789','13800138000','拉卡拉','银联'])assert.ok(!data.receipt.includes(secret));
 assert.ok(data.receipt.includes('卤蛋面'));assert.ok(data.receipt.includes('-15.90'));
 assert.throws(()=>buildAIRequest({...local,normalized:'a'.repeat(12001)},categories),/过多/);
});
test('model selects evidenced payment candidates but cannot override direction, date or account',()=>{
 const out=applyAIResult(local,categories,{...good,amount:1600,type:'income',date:'1900-01-01',accountId:'evil',warnings:[]});
 assert.equal(out.amount,1590);assert.equal(out.type,'expense');assert.equal(out.date,'2026-10-28');assert.equal(out.accountId,undefined);
 assert.equal(out.categoryId,'custom-noodles');assert.equal(out.note,'饺子馆刀削面家常菜 · 卤蛋面');assert.deepEqual(out.candidates.map(c=>c.amount),[1590]);assert.ok(!out.warnings.some(w=>w.startsWith('识别到多个金额')));
});
test('missing/deleted/wrong-type/low-confidence categories retain local advice',()=>{
 for(const value of [{...good,categoryId:'deleted'},{...good,categoryId:'salary'},{...good,confidence:'low'},{...good,categoryId:null}]){
  const out=applyAIResult(local,categories,value);assert.equal(out.category,local.category);assert.equal(out.categoryId,undefined);assert.ok(out.warnings.some(w=>w.includes('未确定')));
 }
});
test('hallucinated notes and payment processors are not accepted; malformed output fails',()=>{
 for(const merchant of ['未在截图里的咖啡馆','拉卡拉支付股份有限公司','<script>alert(1)</script>']){
  const out=applyAIResult(local,categories,{...good,merchant,product:''});assert.equal(out.note,local.note);
 }
 assert.throws(()=>applyAIResult(local,categories,{categoryId:'custom-noodles'}),/格式/);
 assert.throws(()=>applyAIResult(local,categories,[]),/格式/);
});
test('request sends credential only as auth, to fixed endpoint, without cookies, referrer or redirects',async()=>{
 const out=await requestAI(local,categories,key,{fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(options.headers.Authorization,'Bearer '+key);assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');assert.ok(!options.body.includes(key));return response();
 }});assert.equal(out.categoryId,'custom-noodles');
});
test('errors are useful, no retries or provider body echo, blank/truncated JSON rejected',async()=>{
 for(const [status,message] of [[401,'密钥无效'],[402,'余额不足'],[429,'繁忙'],[503,'暂不可用']]){
  let count=0;await assert.rejects(requestAI(local,categories,key,{fetchImpl:async()=>{count++;return {ok:false,status,json:()=>{throw Error(key);}};}}),new RegExp(message));assert.equal(count,1);
 }
 await assert.rejects(requestAI(local,categories,key,{fetchImpl:async()=>response({},'length')}),/不完整/);
 await assert.rejects(requestAI(local,categories,key,{fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'   '}}]})})}),/格式/);
});
test('timeout and cancellation abort the request',async()=>{
 const blocked=async(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('cancel','AbortError'))));
 await assert.rejects(requestAI(local,categories,key,{fetchImpl:blocked,timeoutMs:10}),/超时/);
 const controller=new AbortController(),pending=requestAI(local,categories,key,{fetchImpl:blocked,signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
test('device credentials stay outside ledger backups and can be disabled/removed',async()=>{
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 try{
  assert.equal(readAIConfig().enabled,false);saveAIConfig({enabled:true,key});assert.equal(readAIConfig().key,key);assert.equal(readAIConfig().enabled,true);
  assert.ok(!String(await encodeBackup(initialState(),'')).includes(key));
  saveAIConfig({enabled:false,key});assert.equal(readAIConfig().enabled,false);clearAIConfig();assert.equal(data.has(AI_STORAGE_KEY),false);
  data.set(AI_STORAGE_KEY,'broken');assert.equal(readAIConfig().enabled,false);
 }finally{delete globalThis.localStorage;}
});

test('AI ranks actual payment alternatives, deduplicates and clears stale local ambiguity',()=>{
 const parsed=parsePaymentText('支付成功\n实付金额 19.90\n实付金额 20.00');
 assert.equal(parsed.amount,1990);
 const out=applyAIResult(parsed,categories,{...good,amountCandidates:[20,19.9,20]});
 assert.equal(out.amount,2000);assert.deepEqual(out.candidates.map(c=>c.amount),[2000,1990]);
 assert.ok(out.warnings.some(w=>w.includes('已选中第一个')));assert.ok(!out.warnings.some(w=>w.startsWith('识别到多个金额')));
});
test('AI can find paid decimal amounts missed by local labels and converts cents exactly',()=>{
 for(const [amount,text,expected] of [[19.9,'本次扣款：19.90',1990],[0.29,'实付金额 0.29',29],[1234.5,'实付金额 ¥1,234.50',123450]]){
  const parsed=parsePaymentText('支付成功\n'+text);
  if(amount===19.9)assert.equal(parsed.amount,0);
  const out=applyAIResult(parsed,categories,{...good,amountCandidates:[amount]});
  assert.equal(out.amount,expected);assert.deepEqual(out.candidates.map(c=>c.amount),[expected]);assert.ok(!out.warnings.some(w=>w.startsWith('未找到可靠金额')));
 }
});
test('empty, missing or malformed AI amounts fall back per field without losing category/note',()=>{
 for(const amountCandidates of [[],null,undefined,'15.9',[15.9,15.9,15.9,15.9,15.9,15.9,15.9],[888],['15.9'],[0],[-15.9],[15.901]]){
  const out=applyAIResult(local,categories,{...good,amountCandidates});
  assert.equal(out.amount,local.amount);assert.deepEqual(out.candidates,local.candidates);
  assert.equal(out.categoryId,'custom-noodles');assert.equal(out.note,'饺子馆刀削面家常菜 · 卤蛋面');assert.ok(out.warnings.some(w=>w.includes('已使用本地金额')));
 }
});
test('AI rejects subtotals, discounts, balance, dates, time, counts and identifiers from candidate list',()=>{
 const parsed=parsePaymentText(receipt+'\n余额\n88.00\n订单编号 1234\n数量 2\n支付时间 18:08:24');
 const out=applyAIResult(parsed,categories,{...good,amountCandidates:[16,0.1,88,1234,18,2]});
 assert.deepEqual(out.candidates,parsed.candidates);assert.equal(out.amount,1590);
 const mixed=applyAIResult(parsed,categories,{...good,amountCandidates:[16,15.9,0.1]});
 assert.deepEqual(mixed.candidates.map(c=>c.amount),[1590]);
 const inline=parsePaymentText('支付成功\n余额88.00 实付15.90 优惠0.10\n16.00元（订单金额）');
 assert.deepEqual(applyAIResult(inline,categories,{...good,amountCandidates:[88,16,0.1,15.9]}).candidates.map(c=>c.amount),[1590]);
});
test('no AI or local amount leaves a blank draft for manual entry',()=>{
 const parsed=parsePaymentText('支付成功\n商户名称：测试咖啡馆');
 const out=applyAIResult(parsed,categories,{...good,amountCandidates:[],merchant:'测试咖啡馆',product:''});
 assert.equal(out.amount,0);assert.deepEqual(out.candidates,[]);assert.equal(out.categoryId,'custom-noodles');assert.equal(out.note,'测试咖啡馆');assert.ok(out.warnings.some(w=>w.includes('请手动填写')));
});
