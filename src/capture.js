import {cents,today,validDate} from './model.js';
const paid=/实付|实际支付|实际付款|实收|实际到账|到账金额/;
const amountLabel=/金额|合计|总计|实付|实收|实际到账|支付成功|付款成功|收款成功|转账成功/;
const ignored=/余额|优惠|折扣|立减|红包抵扣|原价|积分|手续费|可用额度|账单日|订单号|交易号|流水号|商户号|手机号|银行卡|尾号|参考号/;
const number=/(?<![\d.])[-+]?\s*(?:\d{1,3}(?:,\d{3})+|\d{1,9})(?:\.\d{1,2})?(?![\d.])/g;
export function parsePaymentText(input,referenceDate=today()){
 if(typeof input!=='string'||input.trim().length<2)throw Error('请先粘贴付款页面识别出的文字');
 if(input.length>20000)throw Error('文字太长，请只保留一笔付款或收款的内容');
 const normalized=input.normalize('NFKC').replace(/[−–]/g,'-').replace(/\r/g,'').trim();
 const lines=normalized.split('\n').map(s=>s.trim()).filter(Boolean);
 const warnings=[],found=[];
 if(/支付失败|付款失败|交易关闭|已取消|待付款|等待付款|等待支付|支付中|处理中|收款中|待收款/.test(normalized))warnings.push('页面可能是未完成或失败的交易，请确认资金已实际收付。');
 if(/USD|HKD|EUR|美元|港币|欧元|US\$|HK\$|€|英镑|GBP/i.test(normalized))warnings.push('可能包含外币；轻账目前只记人民币，请自行换算并修改金额。');
 lines.forEach((line,i)=>{
  for(const match of line.matchAll(number)){
   const raw=match[0].trim(),n=raw.replace(/[,+\s]/g,'');
   const start=match.index,end=start+match[0].length;
   if(/[\d年月日/\-]$/.test(line.slice(0,start))||/\d:$/.test(line.slice(0,start))||/^[:年月日/\-]/.test(line.slice(end)))continue;
   const alone=/^[¥￥+\-\s\d,.元人民币CNY]+$/.test(line);
   const context=line+(alone?' '+(lines[i-1]||''):'');
   const currency=/[¥￥]/.test(line)||/元|人民币|CNY/.test(line);
   if(ignored.test(context)&&!paid.test(context))continue;
   if(!currency&&!amountLabel.test(context)&&!(alone&&(/[.]/.test(raw)||/^[+-]/.test(raw))))continue;
   let value;try{value=Math.abs(cents(n));}catch{continue;}
   if(!value)continue;
   // Bill detail headers show the net cash flow with a sign next to transaction status.
   // Discount/balance lines were excluded above; an order subtotal is a weaker signal.
   const headerStatus=alone&&/^[¥￥\s]*[+-]/.test(line)&&/账单详情/.test(normalized)&&
    [lines[i-1],lines[i+1]].some(s=>/^(?:交易成功|支付成功|付款成功|收款成功)$/.test(s||''));
   const score=(paid.test(context)?200:headerStatus?90:/订单金额|商品金额|订单总额/.test(context)?10:amountLabel.test(context)?40:0)+(currency?20:0)+(alone?15:0);
   found.push({amount:value,score,label:context.slice(0,70),...(headerStatus?{direction:n.startsWith('-')?'expense':'income'}:{})});
  }
 });
 const unique=new Map();for(const c of found)if(!unique.has(c.amount)||unique.get(c.amount).score<c.score)unique.set(c.amount,c);
 const candidates=[...unique.values()].sort((a,b)=>b.score-a.score).slice(0,6);
 if(candidates.length>1)warnings.push('识别到多个金额，已优先建议实付/实收金额，请核对。');
 if(!candidates.length)warnings.push('未找到可靠金额，请手动填写，勿将订单号或余额当作金额。');
 const income=/收款成功|已收款|收钱到账|转账到账|收入金额|到账金额|实收|收到转账|收款到账|退款成功|退款到账/.test(normalized);
 const expense=/支付成功|付款成功|支出|付款金额|实付|转账成功|付款给/.test(normalized);
 const direction=candidates[0]?.direction;
 const type=direction||(income&&!expense?'income':'expense');
 if(direction?((direction==='income'&&expense)||(direction==='expense'&&income)):((!income&&!expense)||(income&&expense)))warnings.push('收支方向不明确，请选择正确的收入或支出。');
 if(/转账|充值|提现|还款/.test(normalized))warnings.push('如果是你自己的账户之间划款，请改为“转账”，避免重复计算收支。');
 if(/退款/.test(normalized))warnings.push('请核对退款是否到账；可记录为收入，或调整原支出，避免重复处理。');
 let merchant='';
 for(let i=0;i<lines.length;i++){
  const match=lines[i].match(/^(?:商户全称|商户名称|商家名称|收款方全称|收款方名称|收款方|付款给|商品名称|交易对方)\s*[:：]?\s*(.*)$/);
  if(match){merchant=(match[1]||lines[i+1]||'').slice(0,80);break;}
 }
 if(!merchant)merchant=lines.find(s=>s.length<60&&/咖啡|餐厅|饭店|奶茶|美团|饿了么|超市|便利店|滴滴|地铁|公交|药房|书店|淘宝|京东/.test(s)&&!amountLabel.test(s))||'';
 const category=type==='income'?(/工资|薪资/.test(normalized)?'工资':'其他收入'):
 [['餐饮',/餐厅|饭店|咖啡|奶茶|早餐|午餐|晚餐|面馆|饺子|刀削面|家常菜|餐饮美食|外卖|美团|饿了么|肯德基|麦当劳|瑞幸|星巴克/],['交通',/滴滴|打车|地铁|公交|停车|高铁|火车|加油/],['健康',/医院|药房|药店|诊所/],['居住',/房租|物业|水费|电费|燃气/],['学习',/书店|课程|学费/],['娱乐',/电影|影院|游戏/],['购物',/超市|便利店|淘宝|京东|商场|购物/]].find(([,r])=>r.test(merchant||normalized))?.[0]||'其他';
 let date=referenceDate;const dm=normalized.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/);
 if(dm){const value=`${dm[1]}-${dm[2].padStart(2,'0')}-${dm[3].padStart(2,'0')}`;if(validDate(value)&&value<=referenceDate)date=value;else warnings.push('识别出的日期无效或在未来，暂用今天，请核对。');}
 else warnings.push('未识别到完整交易日期，暂用今天，请核对。');
 return {normalized,amount:candidates[0]?.amount||0,candidates,type,category,date,note:merchant,warnings,platform:/支付宝/.test(normalized)?'支付宝':/微信|零钱/.test(normalized)?'微信':''};
}
export async function captureFingerprint(text){const bytes=new TextEncoder().encode(text.replace(/\s+/g,' ').trim());const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');}
