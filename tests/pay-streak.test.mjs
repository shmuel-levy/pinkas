import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/lib/logic.js';
import * as S from '../src/lib/storage.js';

const ILS = (n) => n * 100;
const base = () => {
  const s = S.defaultState();
  s.onboarded = true;
  s.balanceAnchor = { checking: ILS(5000), cash: ILS(300), at: 1000 };
  return s;
};
let n = 0;
const exp = (amount, pay, extra = {}) => ({ id: 'e' + n++, amount: ILS(amount), catId: 'x', date: '2026-11-10', note: '', createdAt: 2000, ...(pay ? { pay } : {}), ...extra });

test('cash comes out of cash, everything else out of checking', () => {
  const s = base();
  s.expenses = [exp(100, 'credit'), exp(40, 'app'), exp(20, 'cash'), exp(500, 'transfer'), exp(7)];
  const b = L.liveBalances(s, '2026-11-13');
  assert.equal(b.checking, ILS(5000 - 100 - 40 - 500 - 7), 'no method = checking');
  assert.equal(b.cash, ILS(300 - 20));
});

test('balances: incomes add, older entries and insurance shares and future dates are ignored', () => {
  const s = base();
  s.expenses = [exp(100, 'credit', { createdAt: 500 }), exp(300, 'transfer', { spreadId: 'ins' }), exp(50, 'credit', { date: '2026-12-01' })];
  s.incomes = [{ id: 'i', amount: ILS(1000), date: '2026-11-10', source: 'משכורת', createdAt: 3000 }, { id: 'j', amount: ILS(50), date: '2026-11-11', source: 'מתנה', to: 'cash', createdAt: 3000 }];
  const b = L.liveBalances(s, '2026-11-13');
  assert.equal(b.checking, ILS(6000));
  assert.equal(b.cash, ILS(350));
  assert.equal(L.liveBalances({ ...s, balanceAnchor: null }, '2026-11-13'), null);
});

test('pay labels and standing orders keep their method', () => {
  assert.equal(L.payLabel('app'), 'ביט / פייבוקס');
  assert.equal(L.payFrom('cash'), 'cash');
  assert.equal(L.payFrom('credit'), 'checking');
  const r = L.recurringFromExpense({ note: 'נטפליקס', amount: 5000, catId: 'x', date: '2026-11-05', pay: 'credit' }, 'r');
  assert.equal(r.pay, 'credit');
  const s = base();
  s.recurring = [r, { ...r, id: 'r2', pay: undefined }];
  const out = L.applyRecurring(s, '2026-12-06').added;
  assert.deepEqual(out.map((e) => e.pay).sort(), ['credit', 'transfer']);
});

test('streak counts consecutive days, today or up to yesterday', () => {
  const v = ['2026-11-09', '2026-11-11', '2026-11-12', '2026-11-13'];
  assert.equal(L.streakCount(v, '2026-11-13'), 3);
  assert.equal(L.streakCount(v, '2026-11-14'), 3, 'not opened yet today: streak still alive');
  assert.equal(L.streakCount(v, '2026-11-15'), 0);
  assert.equal(L.streakCount([], '2026-11-15'), 0);
  assert.equal(L.bestStreak([...v, '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']), 4);
  assert.equal(L.streakCount(['2026-12-31', '2027-01-01'], '2027-01-01'), 2, 'across a year');
});

test('activity month marks opened days, logged days and misses', () => {
  const s = base();
  s.visits = ['2026-11-01', '2026-11-02', '2026-11-05'];
  s.expenses = [exp(10, 'cash', { date: '2026-11-02' }), exp(10, 'cash', { date: '2026-11-02', recurringId: 'r' })];
  s.incomes = [{ id: 'i', amount: 1, date: '2026-11-05', source: 'x', createdAt: 1 }];
  const m = L.activityMonth(s, '2026-11', '2026-11-05');
  assert.equal(m.days.length, 30);
  assert.equal(m.firstDow, 0, '1 Nov 2026 is a Sunday');
  assert.deepEqual(m.days[1], { date: '2026-11-02', opened: true, exp: 1, inc: 0, future: false, today: false });
  assert.equal(m.days[4].inc, 1);
  assert.equal(m.opened, 3);
  assert.equal(m.missed, 2);
  assert.equal(m.empty, 3);
  assert.equal(m.days[10].future, true);
});

test('store keeps payment info, balances, visits and tours', () => {
  const s = base();
  s.expenses = [exp(10, 'cash'), exp(10, 'weird')];
  s.incomes = [{ id: 'i', amount: 100, date: '2026-11-01', source: 'x', to: 'cash', createdAt: 1 }];
  s.recurring = [{ id: 'r', name: 'x', amount: 100, catId: 'x', day: 1, startMonth: '2026-01', lastMonth: null, active: true, pay: 'app' }];
  s.visits = ['2026-11-02', '2026-11-01', '2026-11-01', 'bad'];
  s.settings.toursSeen = { home: true, ledger: true, 'bad key!': true };
  s.settings.lastPay = 'cash';
  const back = S.importJSON(S.exportJSON(s));
  assert.equal(back.expenses[0].pay, 'cash');
  assert.equal(back.expenses[1].pay, undefined);
  assert.equal(back.incomes[0].to, 'cash');
  assert.equal(back.recurring[0].pay, 'app');
  assert.deepEqual(back.balanceAnchor, { checking: ILS(5000), cash: ILS(300), at: 1000 });
  assert.deepEqual(back.visits, ['2026-11-01', '2026-11-02']);
  assert.deepEqual(back.settings.toursSeen, { home: true, ledger: true });
  assert.equal(back.settings.lastPay, 'cash');
});
