import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/lib/logic.js';
import * as S from '../src/lib/storage.js';

const ILS = (n) => n * 100;
function stateWith(over = {}) {
  const s = S.defaultState();
  s.onboarded = true;
  s.categories = [
    { id: 'ins', name: 'ביטוחים', budget: ILS(500), color: '#3F6E8C', archived: false },
    { id: 'food', name: 'אוכל בחוץ', budget: ILS(600), color: '#B5532C', archived: false },
  ];
  return { ...s, ...over, settings: { ...s.settings, ...(over.settings || {}) } };
}
const car = { id: 'car', name: 'ביטוח רכב', total: ILS(3600), catId: 'ins', start: '2026-11-05', months: 12, createdAt: 1 };

test('shares are equal and add up exactly, even with leftover agorot', () => {
  assert.deepEqual(L.spreadShares(ILS(3600), 12), Array(12).fill(ILS(300)));
  const odd = L.spreadShares(100001, 12); // ₪1,000.01
  assert.equal(odd.reduce((a, b) => a + b, 0), 100001);
  assert.ok(Math.max(...odd) - Math.min(...odd) <= 1);
  assert.deepEqual(L.spreadShares(500, 1), [500]);
});

test('one share per month from the payment date, marked as fixed', () => {
  const e = L.spreadEntries(car);
  assert.equal(e.length, 12);
  assert.deepEqual(e.map((x) => x.date).slice(0, 3), ['2026-11-05', '2026-12-05', '2027-01-05']);
  assert.equal(e[11].date, '2027-10-05');
  assert.equal(e[0].note, 'ביטוח רכב (1/12)');
  assert.ok(e.every((x) => x.recurringId === 'spread:car' && x.spreadId === 'car' && x.amount === ILS(300)));
  // payment on the 31st -> later shares on the 28th so every month gets exactly one
  const late = L.spreadEntries({ ...car, start: '2026-01-31' });
  assert.equal(late[0].date, '2026-01-28');
  assert.equal(late[1].date, '2026-02-28');
});

test('each budget cycle gets exactly one share, whatever the cycle day', () => {
  for (const cycleDay of [1, 10, 25]) {
    let c = L.cycleFor('2026-11-20', cycleDay);
    for (let i = 0; i < 10; i++) {
      const inC = L.spreadEntries(car).filter((e) => L.inCycle(e.date, c));
      assert.equal(inC.length, 1, `cycleDay ${cycleDay}, cycle ${c.start}`);
      c = L.shiftCycle(c, 1);
    }
  }
});

test('syncSpreads rebuilds shares and is idempotent; deleting removes them', () => {
  const s = stateWith({ spreads: [car], expenses: [{ id: 'x', amount: 100, catId: 'food', date: '2026-11-02', note: '', createdAt: 0 }] });
  const a = L.syncSpreads(s);
  assert.equal(a.expenses.length, 13);
  const b = L.syncSpreads(a);
  assert.equal(b.expenses.length, 13);
  const edited = L.syncSpreads({ ...b, spreads: [{ ...car, total: ILS(2400) }] });
  assert.ok(edited.expenses.filter((e) => e.spreadId).every((e) => e.amount === ILS(200)));
  const removed = L.syncSpreads({ ...b, spreads: [] });
  assert.deepEqual(removed.expenses.map((e) => e.id), ['x']);
});

test('the month only feels its share: budget, daily allowance and report', () => {
  const s = L.syncSpreads(stateWith({ settings: { monthlyBudget: ILS(3000) }, spreads: [car] }));
  const sum = L.cycleSummary(s, '2026-11-05');
  const ins = sum.cats.find((r) => r.cat.id === 'ins').status;
  assert.equal(ins.spent, ILS(300), 'not ₪3,600');
  assert.equal(ins.state, 'ok');
  assert.equal(sum.overall.spentToday, 0, 'a share dated today is not "spent today"');
  assert.equal(sum.overall.todayLeft, sum.overall.perDay);
  const r = L.monthlyReport(s, L.cycleFor('2026-11-15', 1), '2026-12-02');
  assert.equal(r.fixed, ILS(300));
});

test('shares never count as places, habits or spend days', () => {
  const s = L.syncSpreads(stateWith({ spreads: [car] }));
  assert.equal(L.learnPlaces(s.expenses).length, 0);
  const cal = L.noSpendCalendar(s, L.cycleFor('2026-11-20', 1), '2026-11-20');
  assert.equal(cal.days.find((d) => d.date === '2026-11-05').spent, 0);
});

test('spreadInfo: progress, monthly share and renewal window', () => {
  let i = L.spreadInfo(car, '2026-11-20');
  assert.equal(i.monthly, ILS(300));
  assert.equal(i.passed, 1);
  assert.equal(i.end, '2027-11-05');
  assert.equal(i.renewSoon, false);
  i = L.spreadInfo(car, '2027-10-20');
  assert.equal(i.passed, 12);
  assert.equal(i.renewSoon, true);
  assert.equal(i.active, true);
  i = L.spreadInfo(car, '2027-11-06');
  assert.equal(i.active, false);
  assert.equal(i.renewSoon, false);
});

test('spreadTotals counts only running items', () => {
  const future = { ...car, id: 'f', start: '2027-03-01' };
  const old = { ...car, id: 'o', start: '2025-01-01' };
  const t = L.spreadTotals([car, future, old], '2026-11-20');
  assert.equal(t.count, 1);
  assert.equal(t.monthly, ILS(300));
  assert.equal(t.yearly, ILS(3600));
});

test('store keeps spreads and the share link through backup/restore', () => {
  const s = L.syncSpreads(stateWith({ spreads: [car] }));
  const back = S.importJSON(S.exportJSON(s));
  assert.equal(back.spreads.length, 1);
  assert.deepEqual(back.spreads[0], car);
  assert.equal(back.expenses.filter((e) => e.spreadId === 'car').length, 12);
  const junk = S.normalize({ categories: [{ id: 'a', name: 'א' }], expenses: [], spreads: [{ name: 'x', total: -1 }, { name: 'ok', total: 1200, start: '2026-01-01', months: 99, catId: 'ghost' }] });
  assert.equal(junk.spreads.length, 1);
  assert.equal(junk.spreads[0].months, 36);
  assert.equal(junk.spreads[0].catId, 'a');
});

test('new installs include an insurance category', () => {
  assert.ok(S.defaultState().categories.some((c) => c.name === 'ביטוחים'));
});
