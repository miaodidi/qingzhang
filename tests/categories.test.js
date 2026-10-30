import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,upgradeCategories,sortedCategories,validate} from '../src/model.js';
import {decodeBackup} from '../src/store.js';
test('category upgrade preserves custom IDs, records and budgets, adds missing names only once',async()=>{
 const s=initialState();delete s.settings.categoryCatalogVersion;
 s.categories=s.categories.filter(c=>!c.id.startsWith('default-'));
 s.categories.push({id:'custom-drink',name:'饮料',type:'expense'});
 s.transactions=[{id:'t',type:'expense',amount:100,date:'2026-01-01',accountId:s.accounts[0].id,categoryId:'custom-drink',note:''}];
 s.budgets={'2026-01':{total:100,categories:{'custom-drink':100}}};
 const before=structuredClone(s),restored=await decodeBackup(JSON.stringify(s),'');
 assert.deepEqual(restored.transactions,before.transactions);assert.deepEqual(restored.budgets,before.budgets);
 assert.equal(restored.categories.filter(c=>c.name==='饮料').length,1);
 assert.equal(restored.categories.find(c=>c.name==='饮料').id,'custom-drink');
 assert.equal(restored.categories.length,48);validate(restored);
 restored.categories=restored.categories.filter(c=>c.name!=='游戏');
 upgradeCategories(restored);assert(!restored.categories.some(c=>c.name==='游戏'));
});
test('sorting uses count, ignores transfers, keeps ties stable and does not mutate the ledger',()=>{
 const s=initialState();s.transactions=[{type:'expense',categoryId:'e1',amount:1},{type:'expense',categoryId:'e1',amount:1},{type:'expense',categoryId:'e0',amount:99999},{type:'income',categoryId:'i1',amount:1},{type:'transfer',categoryId:'e2',amount:1}];
 const before=structuredClone(s);
 assert.deepEqual(sortedCategories(s,'expense').slice(0,3).map(c=>c.id),['e1','e0','e2']);
 assert.equal(sortedCategories(s,'income')[0].id,'i1');assert.deepEqual(s,before);
 s.transactions.push({type:'expense',categoryId:'e0',amount:1},{type:'expense',categoryId:'e0',amount:1});
 assert.equal(sortedCategories(s,'expense')[0].id,'e0');
});
