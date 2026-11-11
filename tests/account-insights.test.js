import test from 'node:test';
import assert from 'node:assert/strict';
import {captureAccount,accountSpending} from '../src/account-insights.js';
const accounts=[{id:'daily',name:'日常账户',kind:'银行卡'},{id:'wx',name:'微信',kind:'其他'},{id:'ali',name:'我的付款钱包',kind:'支付宝'},{id:'bank',name:'工资卡',kind:'银行卡'}];
test('capture chooses exact name, account type, or unique alias from the current catalog',()=>{
 assert.equal(captureAccount(accounts,'微信').account.id,'wx');
 assert.equal(captureAccount(accounts,'支付宝').account.id,'ali');
 assert.equal(captureAccount([{id:'wallet',name:'微信钱包',kind:'其他'},accounts[0]],'微信').account.id,'wallet');
 assert.equal(captureAccount([...accounts,{id:'exact',name:'支付宝',kind:'其他'}],'支付宝').account.id,'exact');
 assert.equal(captureAccount(accounts.filter(a=>a.id!=='wx'),'微信').account.id,'daily');
 assert.equal(captureAccount(accounts,'').account.id,'daily');
 assert.equal(captureAccount(accounts.slice(1),'').account.id,'wx');
 const multiple=[accounts[0],{id:'a',name:'个人微信',kind:'微信'},{id:'b',name:'工作微信',kind:'微信'}];
 assert.equal(captureAccount(multiple,'微信').account.id,'daily');
 assert.equal(captureAccount(multiple,'微信').ambiguous,true);
});
test('spending uses integer cents, excludes transfer/income/balances, retains zero accounts',()=>{
 const rows=accountSpending(accounts,[{accountId:'wx',type:'expense',amount:1590},{accountId:'wx',type:'expense',amount:10},{accountId:'ali',type:'expense',amount:400},{accountId:'wx',type:'income',amount:100000},{accountId:'wx',toAccountId:'ali',type:'transfer',amount:90000}]);
 assert.deepEqual(rows.map(r=>[r.id,r.amount,r.count,r.percent]),[['wx',1600,2,80],['ali',400,1,20],['daily',0,0,0],['bank',0,0,0]]);
 assert.ok(accountSpending(accounts,[]).every(r=>r.amount===0&&r.percent===0));
});
