// Read the current catalog for every capture; never create accounts implicitly.
export function captureAccount(accounts, platform) {
 const fallback = accounts.find(a => a.name === '日常账户') || accounts[0];
 if (!['微信', '支付宝'].includes(platform)) return {account: fallback, matched: false};
 const exact = accounts.find(a => a.name.trim() === platform);
 if (exact) return {account: exact, matched: true};
 const typed = accounts.filter(a => a.kind === platform);
 const named = accounts.filter(a => a.name.includes(platform));
 const candidates = typed.length ? typed : named;
 if (candidates.length === 1) return {account: candidates[0], matched: true};
 return {account: fallback, matched: false, ambiguous: candidates.length > 1};
}

// Amounts remain integer cents. Transfers and income are not spending.
export function accountSpending(accounts, transactions) {
 const rows = accounts.map(a => ({id: a.id, name: a.name, kind: a.kind, amount: 0, count: 0}));
 const byId = new Map(rows.map(a => [a.id, a]));
 for (const t of transactions) {
  const row = byId.get(t.accountId);
  if (row && t.type === 'expense') { row.amount += t.amount; row.count++; }
 }
 const total = rows.reduce((sum, a) => sum + a.amount, 0);
 return rows.sort((a, b) => b.amount - a.amount).map(a => ({...a, percent: total ? a.amount / total * 100 : 0}));
}
