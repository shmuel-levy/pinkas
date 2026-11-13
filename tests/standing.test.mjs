import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/lib/logic.js';
import * as S from '../src/lib/storage.js';

const ILS = (n) => n * 100;
function stateWith(over = {}) {
  const s = S.defaultState();
  s.onboarded = true;
  s.categories = [
    { id: 'subs', name: 'מנויים', budget: 0, color: '#3F6E8C', archived: false },
    { id: 'food', name: 'אוכל בחוץ', budget: ILS(600), color: '#B5532C', archived: false },
    { id: 'misc', name: 'אחר', budget: 0, color: '#6B6B5A', archived: false },
  ];
  return { ...s, ...over, settings: { ...s.settings, ...(over.settings || {}) } };
}
let n = 0;
const exp = (amount, catId, date, note = '', extra = {}) => ({ id: 'e' + n++, amount: ILS(amount), catId, date, note, createdAt: n, ...extra });

/* ---------- standing order detection ---------- */
test('asks for anything in the subscriptions category', () => {
  const h = L.standingOrderHint(stateWith(), { note: 'משהו', catId: 'subs', amount: ILS(30) });
  assert.deepEqual([h.ask, h.reason], [true, 'category']);
});

test('asks for well-known subscription names in any category, whole words only', () => {
  const s = stateWith();
  for (const note of ['נטפליקס', 'Netflix Premium', 'מנוי ספוטיפיי', 'Wolt+', 'חדר כושר', 'ChatGPT Plus']) {
    assert.equal(L.standingOrderHint(s, { note, catId: 'misc', amount: ILS(10) }).ask, true, note);
  }
  for (const note of ['hotdog', 'Yes Planet', 'פיצה', 'Photoshop course', '']) {
    assert.equal(L.standingOrderHint(s, { note, catId: 'food', amount: ILS(10) }).ask, false, note);
  }
});

test('asks when the same place and amount already appeared in two months', () => {
  const s = stateWith({ expenses: [exp(120, 'misc', '2026-09-03', 'ועד בית'), exp(120, 'misc', '2026-10-03', 'ועד בית')] });
  assert.deepEqual(L.standingOrderHint(s, { note: 'ועד בית', catId: 'misc', amount: ILS(120) }).reason, 'pattern');
  assert.equal(L.standingOrderHint(s, { note: 'ועד בית', catId: 'misc', amount: ILS(90) }).ask, false, 'different amount');
});

test('does not ask when it is already a standing order', () => {
  const s = stateWith({ recurring: [{ id: 'r', name: 'Netflix', amount: ILS(50), catId: 'subs', day: 5, startMonth: '2026-01', lastMonth: '2026-11', active: true }] });
  const h = L.standingOrderHint(s, { note: ' netflix ', catId: 'subs', amount: ILS(50) });
  assert.equal(h.ask, false);
  assert.equal(h.existing.id, 'r');
});

test('a recorded expense becomes a standing order without double-charging this month', () => {
  const r = L.recurringFromExpense({ note: 'נטפליקס', amount: ILS(55), catId: 'subs', date: '2026-11-07' }, 'r1');
  assert.deepEqual(r, { id: 'r1', name: 'נטפליקס', amount: ILS(55), catId: 'subs', day: 7, startMonth: '2026-11', lastMonth: '2026-11', active: true });
  const s = stateWith({ recurring: [r], expenses: [exp(55, 'subs', '2026-11-07', 'נטפליקס', { recurringId: 'r1' })] });
  assert.equal(L.applyRecurring(s, '2026-11-30').added.length, 0, 'November already recorded');
  const dec = L.applyRecurring(s, '2026-12-07');
  assert.deepEqual(dec.added.map((e) => [e.date, e.amount]), [['2026-12-07', ILS(55)]]);
  // recorded late (last month): next month is filled in right away
  const late = L.recurringFromExpense({ note: 'ספוטיפיי', amount: ILS(20), catId: 'subs', date: '2026-10-20' }, 'r2');
  assert.deepEqual(L.applyRecurring(stateWith({ recurring: [late] }), '2026-11-25').added.map((e) => e.date), ['2026-11-20']);
});

/* ---------- income entries ---------- */
const inc = (amount, date, source = 'משכורת') => ({ id: 'i' + n++, amount: ILS(amount), date, source, note: '', createdAt: n });

test('income priority: check-in, then logged incomes, then the setting', () => {
  const nov = L.cycleFor('2026-11-15', 1);
  const s = stateWith({ settings: { income: ILS(9000) } });
  assert.equal(L.incomeForCycle(s, nov).source, 'setting');
  s.incomes = [inc(12000, '2026-11-10'), inc(800, '2026-11-20', 'עבודה נוספת'), inc(500, '2026-10-30')];
  assert.deepEqual(L.incomeForCycle(s, nov), { amount: ILS(12800), source: 'entries' });
  s.snapshots = [{ id: 'a', period: '2026-11', date: '2026-11-10', income: ILS(13000), cash: 0, investments: 0, savings: 0 }];
  assert.deepEqual(L.incomeForCycle(s, nov), { amount: ILS(13000), source: 'checkin' });
});

test('daily totals combine spending and income per day', () => {
  const s = stateWith({ expenses: [exp(30, 'food', '2026-11-03'), exp(20, 'food', '2026-11-03'), exp(99, 'food', '2026-10-31')], incomes: [inc(12000, '2026-11-03')] });
  const d = L.dailyTotals(s, L.cycleFor('2026-11-15', 1));
  assert.deepEqual(d.get('2026-11-03'), { spent: ILS(50), income: ILS(12000), count: 3 });
  assert.equal(d.has('2026-10-31'), false);
});

test('category shares: largest first, shares add to 1', () => {
  const s = stateWith({ expenses: [exp(300, 'food', '2026-11-03'), exp(100, 'misc', '2026-11-04'), exp(100, 'subs', '2026-11-05')] });
  const rows = L.categoryShares(s, L.cycleFor('2026-11-15', 1));
  assert.deepEqual(rows.map((r) => r.cat.id), ['food', 'subs', 'misc'], 'ties keep the category order');
  assert.equal(rows[0].share, 0.6);
  assert.equal(Math.round(rows.reduce((t, r) => t + r.share, 0) * 1000), 1000);
});

test('CSV includes incomes with a type column', () => {
  const s = stateWith({ expenses: [exp(30, 'food', '2026-11-03', 'פיצה')], incomes: [inc(100, '2026-11-01', 'מתנה')] });
  const lines = L.toCSV(s).slice(1).split('\r\n');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /^"2026-11-01","הכנסה","מתנה","100\.00"/);
  assert.match(lines[2], /^"2026-11-03","הוצאה","אוכל בחוץ","30\.00","פיצה"/);
});

test('store keeps income entries through backup and drops junk', () => {
  const s = stateWith({ incomes: [inc(100, '2026-11-01', 'מתנה')] });
  const back = S.importJSON(S.exportJSON(s));
  assert.equal(back.incomes.length, 1);
  assert.equal(back.incomes[0].source, 'מתנה');
  assert.deepEqual(S.normalize({ categories: [{ id: 'a', name: 'א' }], expenses: [], incomes: [{ amount: -1, date: '2026-01-01' }, { amount: 5 }] }).incomes, []);
  assert.deepEqual(S.normalize({ categories: [{ id: 'a', name: 'א' }], expenses: [] }).incomes, []);
});
