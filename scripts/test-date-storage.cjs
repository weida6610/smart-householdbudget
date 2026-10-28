const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('src/程式碼.js', 'utf8'), context);
let written;
context.ensureTransactionSheet = () => ({
  appendRow: row => { written = row; },
  getRange: () => ({ setValues: rows => { written = rows[0]; } })
});
context.makeId = () => 'test';
context.normalizeDateTime = () => '';
context.findTransactionRow = () => ({ rowNumber: 2, transaction: { id: 'test' } });
const actor = { chatId: 'test' };
const dateIndex = context.HEADERS.TRANSACTIONS.indexOf('date');
for (const input of ['115/11/01', '2026/11/01']) {
  const payload = { id: 'test', date: input, type: 'expense', amount: 120 };
  for (const method of ['createTransaction', 'updateTransaction']) {
    const result = context[method](payload, actor);
    assert.equal(written[dateIndex], '2026-11-01');
    assert.equal(result.date, '2026-11-01');
    assert.equal(context.normalizeSheetDate(written[dateIndex]).slice(0, 7), '2026-11');
  }
}
assert.equal(context.parseFlexibleDate('116/01/01'), '2027-01-01');
assert.equal(context.parseFlexibleDate('11/01'), null);
console.log('Date storage regression checks passed');
