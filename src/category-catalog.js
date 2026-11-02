import {sortedCategories,uid} from './model.js';
export function setCategoryOrder(s,type,ids){
 const existing=sortedCategories(s,type).map(c=>c.id),valid=new Set(existing);
 const order=[...new Set(ids.filter(id=>valid.has(id))),...existing.filter(id=>!ids.includes(id))];
 s.settings.categoryOrder={...s.settings.categoryOrder,[type]:order};
}
export function addCategory(s,type,name){
 name=name.trim();if(!['expense','income'].includes(type)||!name||name.length>20)throw Error('分类名称请填写 1–20 个字');
 if(s.categories.some(c=>c.type===type&&c.name===name))throw Error('这个分类已存在');
 const order=sortedCategories(s,type).map(c=>c.id),id=uid();s.categories.push({id,type,name});setCategoryOrder(s,type,[...order,id]);return id;
}
export function categoryReferences(s,id){return {transactions:s.transactions.filter(t=>t.categoryId===id).length,rules:s.rules.filter(r=>r.categoryId===id).length,budgets:Object.values(s.budgets).filter(b=>Object.hasOwn(b.categories,id)).length};}
export function removeCategory(s,id,replacementId){
 const category=s.categories.find(c=>c.id===id);if(!category)throw Error('此分类已不存在');
 if(s.categories.filter(c=>c.type===category.type).length<=1)throw Error('每种类型至少保留一个分类');
 const refs=categoryReferences(s,id),used=Object.values(refs).some(Boolean);
 if(used&&!s.categories.some(c=>c.id===replacementId&&c.id!==id&&c.type===category.type))throw Error('请选择同类型分类接收已有记录');
 const order=sortedCategories(s,category.type).map(c=>c.id).filter(x=>x!==id);
 for(const t of [...s.transactions,...s.rules])if(t.categoryId===id)t.categoryId=replacementId;
 for(const b of Object.values(s.budgets)){
  if(Object.hasOwn(b.categories,id)){
   const sum=(b.categories[replacementId]||0)+b.categories[id];if(!Number.isSafeInteger(sum)||sum>99999999999)throw Error('合并后的分类预算金额过大');
   b.categories[replacementId]=sum;delete b.categories[id];
   if(b.removedCategories)b.removedCategories=b.removedCategories.filter(x=>x!==replacementId);
  }
  if(b.removedCategories)b.removedCategories=b.removedCategories.filter(x=>x!==id);
 }
 s.categories=s.categories.filter(c=>c.id!==id);setCategoryOrder(s,category.type,order);
}
