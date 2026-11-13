import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/lib/logic.js';
import * as S from '../src/lib/storage.js';

const ILS = (n) => n * 100;

function stateWith(over = {}) {
  const s = S.defaultState();
  s.onboarded = true;
  s.categories = [
    { id: 'food', name: 'אוכל בחוץ', budget: ILS(600), color: '#B5532C', archived: false },
    { id: 'super', name: 'סופר', budget: ILS(1500), color: '#5B7A4E', archived: false },
    { id: 'misc', name: 'אחר', budget: 0, color: '#6B6B5A', archived: false },
  ];
  return { ...s, ...over, settings: { ...s.settings, ...(over.settings || {}) } };
}
const exp = (id, amount, catId, date, extra = {}) => ({ id, amount: ILS(amount), catId, date, note: '', createdAt: 0, ...extra });

test('parseAmount handles common inputs', () => {
  assert.equal(L.parseAmount('12'), 1200);
  assert.equal(L.parseAmount('12.5'), 1250);
  assert.equal(L.parseAmount('12.05'), 1205);
  assert.equal(L.parseAmount('1,200'), 120000);
  assert.equal(L.parseAmount('.5'), 50);
  assert.equal(L.parseAmount('₪ 30'), 3000);
  assert.equal(L.parseAmount('12.345'), null);
  assert.equal(L.parseAmount('abc'), null);
  assert.equal(L.parseAmount('-5'), null);
  assert.equal(L.parseAmount(''), null);
  assert.equal(L.parseAmount('99999999'), null);
  assert.equal(L.parseAmount(0.1 + 0.2), 30);
});

test('formatMoney', () => {
  assert.equal(L.formatMoney(123456), '₪1,234.56');
  assert.equal(L.formatMoney(120000), '₪1,200');
  assert.equal(L.formatMoney(-8400), '−₪84');
  assert.equal(L.formatMoney(500, '₪', { signed: true }), '+₪5');
  assert.equal(L.formatMoney(1250, '₪', { round: true }), '₪13');
  assert.equal(L.formatMoney(0), '₪0');
});

test('keypadInput state machine', () => {
  let s = '';
  for (const k of ['0', '0', '5']) s = L.keypadInput(s, k);
  assert.equal(s, '5');
  s = L.keypadInput(s, '.');
  s = L.keypadInput(s, '.');
  assert.equal(s, '5.');
  for (const k of ['2', '5', '9']) s = L.keypadInput(s, k);
  assert.equal(s, '5.25');
  s = L.keypadInput(s, 'back');
  assert.equal(s, '5.2');
  assert.equal(L.keypadInput('', '.'), '0.');
  assert.equal(L.keypadInput('1234567', '8'), '1234567');
  assert.equal(L.keypadInput('12', 'x'), '12');
  assert.equal(L.parseAmount(L.keypadInput('', '.')), 0);
});

test('cycleFor with day 1 and custom day', () => {
  assert.deepEqual(L.cycleFor('2026-11-12', 1), { start: '2026-11-01', end: '2026-12-01', key: '2026-11', cycleDay: 1 });
  assert.deepEqual(L.cycleFor('2026-11-09', 10), { start: '2026-10-10', end: '2026-11-10', key: '2026-10', cycleDay: 10 });
  assert.deepEqual(L.cycleFor('2026-11-10', 10), { start: '2026-11-10', end: '2026-12-10', key: '2026-11', cycleDay: 10 });
  // year boundary
  assert.deepEqual(L.cycleFor('2027-01-05', 10), { start: '2026-12-10', end: '2027-01-10', key: '2026-12', cycleDay: 10 });
  assert.deepEqual(L.cycleFor('2026-12-31', 1).end, '2027-01-01');
  // out-of-range day is clamped
  assert.equal(L.cycleFor('2026-02-15', 31).cycleDay, 28);
  assert.equal(L.cycleFor('2026-02-15', 0).cycleDay, 1);
});

test('shiftCycle across years and labels', () => {
  const c = L.cycleFor('2026-01-15', 1);
  assert.equal(L.shiftCycle(c, -1).start, '2025-12-01');
  assert.equal(L.shiftCycle(c, 12).start, '2027-01-01');
  assert.equal(L.cycleLabel(c), 'ינואר 2026');
  assert.equal(L.cycleLabel(L.cycleFor('2026-11-12', 10)), '10 בנוב׳ – 9 בדצמ׳');
});

test('dayDiff is DST safe (Israel DST ends late October)', () => {
  assert.equal(L.dayDiff('2026-10-20', '2026-11-01'), 12);
  assert.equal(L.dayDiff('2026-03-20', '2026-04-01'), 12);
  assert.equal(L.dayDiff('2026-11-01', '2026-12-01'), 30);
  assert.equal(L.addDays('2026-10-24', 7), '2026-10-31');
});

test('budgetStatus: daily allowance and pace', () => {
  const cycle = L.cycleFor('2026-11-11', 1); // 30 days, today is day 11 -> 20 days left incl today
  const st = L.budgetStatus({
    budget: ILS(600),
    expenses: [exp('a', 100, 'food', '2026-11-02'), exp('b', 50, 'food', '2026-11-11')],
    cycle,
    today: '2026-11-11',
  });
  assert.equal(st.daysLeft, 20);
  assert.equal(st.elapsed, 11);
  assert.equal(st.spent, ILS(150));
  assert.equal(st.left, ILS(450));
  // allowance computed from start of today: (600-100)/20 = 25 ; today spent 50 -> -25
  assert.equal(st.perDay, ILS(25));
  assert.equal(st.todayLeft, ILS(-25));
  assert.equal(st.state, 'ok');
});

test('budgetStatus states: warn at threshold, over beyond budget', () => {
  const cycle = L.cycleFor('2026-11-20', 1);
  const mk = (amt) => L.budgetStatus({ budget: ILS(600), expenses: [exp('a', amt, 'food', '2026-11-03')], cycle, today: '2026-11-20' });
  assert.equal(mk(479).state, 'ok');
  assert.equal(mk(480).state, 'warn');
  assert.equal(mk(600).state, 'warn');
  assert.equal(mk(601).state, 'over');
  assert.equal(mk(700).left, ILS(-100));
});

test('budgetStatus projection only after enough data', () => {
  const c = L.cycleFor('2026-11-02', 1);
  const early = L.budgetStatus({ budget: ILS(600), expenses: [exp('a', 100, 'food', '2026-11-01')], cycle: c, today: '2026-11-02' });
  assert.equal(early.projectionReliable, false);
  assert.equal(early.willOverrun, false);
  const mid = L.budgetStatus({ budget: ILS(600), expenses: [exp('a', 300, 'food', '2026-11-03')], cycle: c, today: '2026-11-10' });
  assert.equal(mid.projected, ILS(900)); // 300/10*30
  assert.equal(mid.willOverrun, true);
});

test('budgetStatus for a past cycle has no daily allowance', () => {
  const c = L.cycleFor('2026-10-05', 1);
  const st = L.budgetStatus({ budget: ILS(600), expenses: [exp('a', 100, 'food', '2026-10-05')], cycle: c, today: '2026-11-12' });
  assert.equal(st.daysLeft, 0);
  assert.equal(st.perDay, 0);
  assert.equal(st.elapsed, 31);
});

test('budgetStatus without budget', () => {
  const st = L.budgetStatus({ budget: 0, expenses: [exp('a', 10, 'misc', '2026-11-01')], cycle: L.cycleFor('2026-11-01'), today: '2026-11-01' });
  assert.equal(st.hasBudget, false);
  assert.equal(st.state, 'none');
  assert.equal(st.spent, 1000);
});

test('impactOf warns before going over the eating-out budget', () => {
  const s = stateWith({ expenses: [exp('a', 550, 'food', '2026-11-05')] });
  const i = L.impactOf(s, { catId: 'food', amount: ILS(80), date: '2026-11-12' }, '2026-11-12');
  assert.equal(i.willBeOver, true);
  assert.equal(i.overBy, ILS(30));
  assert.equal(i.wasOver, false);
  const ok = L.impactOf(s, { catId: 'food', amount: ILS(20), date: '2026-11-12' }, '2026-11-12');
  assert.equal(ok.willBeOver, false);
  assert.equal(ok.leftAfter, ILS(30));
  // crossing the 80% warning line
  const s2 = stateWith({ expenses: [exp('a', 400, 'food', '2026-11-05')] });
  assert.equal(L.impactOf(s2, { catId: 'food', amount: ILS(100), date: '2026-11-12' }, '2026-11-12').crossesWarn, true);
  assert.equal(L.impactOf(s2, { catId: 'food', amount: ILS(50), date: '2026-11-12' }, '2026-11-12').crossesWarn, false);
  // no budget -> no impact
  assert.equal(L.impactOf(s, { catId: 'misc', amount: ILS(80), date: '2026-11-12' }, '2026-11-12'), null);
  // expense dated in previous cycle doesn't count against this one
  const prev = L.impactOf(s, { catId: 'food', amount: ILS(80), date: '2026-10-30' }, '2026-11-12');
  assert.equal(prev.willBeOver, false);
  assert.equal(prev.currentCycle, false);
});

test('impactOf per-day after never exceeds what is left', () => {
  const s = stateWith();
  // 12 Nov, cycle day 1 -> 19 days left incl. today
  const i = L.impactOf(s, { catId: 'food', amount: ILS(580), date: '2026-11-12' }, '2026-11-12');
  assert.equal(i.leftAfter, ILS(20));
  assert.ok(i.perDayAfter <= i.leftAfter);
  assert.equal(i.perDayAfter, Math.floor(ILS(20) / 19));
  const over = L.impactOf(s, { catId: 'food', amount: ILS(700), date: '2026-11-12' }, '2026-11-12');
  assert.equal(over.perDayAfter, 0);
});

test('impactOf excludes the expense being edited', () => {
  const s = stateWith({ expenses: [exp('a', 590, 'food', '2026-11-05')] });
  const i = L.impactOf(s, { catId: 'food', amount: ILS(595), date: '2026-11-05', excludeId: 'a' }, '2026-11-12');
  assert.equal(i.willBeOver, false);
});

test('recurringDue generates missed months once and clamps day 31', () => {
  const r = [{ id: 'r1', name: 'שכירות', amount: ILS(4000), catId: 'misc', day: 31, startMonth: '2026-01', lastMonth: null, active: true }];
  const due = L.recurringDue(r, '2026-03-15');
  assert.deepEqual(due.map((d) => d.date), ['2026-01-31', '2026-02-28']);
  const due2 = L.recurringDue([{ ...r[0], lastMonth: '2026-02' }], '2026-03-31');
  assert.deepEqual(due2.map((d) => d.date), ['2026-03-31']);
  assert.equal(L.recurringDue([{ ...r[0], active: false }], '2026-03-31').length, 0);
});

test('applyRecurring adds entries and is idempotent', () => {
  const s = stateWith({ recurring: [{ id: 'r1', name: 'נטפליקס', amount: ILS(50), catId: 'misc', day: 5, startMonth: '2026-10', lastMonth: null, active: true }] });
  const a = L.applyRecurring(s, '2026-11-12');
  assert.equal(a.added.length, 2);
  assert.equal(a.state.recurring[0].lastMonth, '2026-11');
  assert.equal(a.state.expenses.every((e) => e.recurringId === 'r1'), true);
  const b = L.applyRecurring(a.state, '2026-11-12');
  assert.equal(b.added.length, 0);
  assert.equal(s.expenses.length, 0, 'original state not mutated');
});

test('upcomingRecurring reserves charges still to come in this cycle', () => {
  const rec = [
    { id: 'r1', name: 'חוג', amount: ILS(200), catId: 'misc', day: 20, startMonth: '2026-11', lastMonth: null, active: true },
    { id: 'r2', name: 'כבר שולם', amount: ILS(99), catId: 'misc', day: 3, startMonth: '2026-11', lastMonth: '2026-11', active: true },
  ];
  const cycle = L.cycleFor('2026-11-12', 1);
  const up = L.upcomingRecurring(rec, cycle, '2026-11-12');
  assert.deepEqual(up.map((u) => u.date), ['2026-11-20']);
  // custom cycle spanning two months
  const c10 = L.cycleFor('2026-11-12', 10); // 10 Nov - 9 Dec
  const rec3 = [{ id: 'r3', name: 'x', amount: 100, catId: 'misc', day: 5, startMonth: '2026-11', lastMonth: '2026-11', active: true }];
  assert.deepEqual(L.upcomingRecurring(rec3, c10, '2026-11-12').map((u) => u.date), ['2026-12-05']);
});

test('cycleSummary includes reserved fixed costs in overall allowance', () => {
  const s = stateWith({
    settings: { monthlyBudget: ILS(3000) },
    expenses: [exp('a', 600, 'super', '2026-11-02')],
    recurring: [{ id: 'r1', name: 'חוג', amount: ILS(400), catId: 'misc', day: 25, startMonth: '2026-11', lastMonth: null, active: true }],
  });
  const sum = L.cycleSummary(s, '2026-11-11');
  assert.equal(sum.overall.budget, ILS(3000));
  assert.equal(sum.overall.reserved, ILS(400));
  assert.equal(sum.overall.left, ILS(2000));
  assert.equal(sum.overall.perDay, ILS(100)); // 2000 / 20 days
  // budget derived from categories when no explicit total
  const s2 = stateWith();
  assert.equal(L.overallBudget(s2), ILS(2100));
});

test('derived overall budget ignores categories without a budget', () => {
  const s = stateWith({
    expenses: [exp('a', 100, 'food', '2026-11-02'), exp('rent', 4000, 'misc', '2026-11-01', { recurringId: 'r' })],
    recurring: [{ id: 'r2', name: 'x', amount: ILS(999), catId: 'misc', day: 20, startMonth: '2026-11', lastMonth: null, active: true }],
  });
  const sum = L.cycleSummary(s, '2026-11-11');
  assert.equal(sum.overall.derived, true);
  assert.equal(sum.overall.spent, ILS(100));
  assert.equal(sum.overall.reserved, 0);
  assert.equal(sum.overall.left, ILS(2000));
  // explicit total counts everything
  s.settings.monthlyBudget = ILS(8000);
  const sum2 = L.cycleSummary(s, '2026-11-11');
  assert.equal(sum2.overall.derived, false);
  assert.equal(sum2.overall.spent, ILS(4100));
  assert.equal(sum2.overall.reserved, ILS(999));
});

test('noSpendCalendar ignores fixed charges and counts streak', () => {
  const s = stateWith({
    expenses: [
      exp('a', 10, 'food', '2026-11-01'),
      exp('b', 10, 'food', '2026-11-03'),
      exp('c', 4000, 'misc', '2026-11-05', { recurringId: 'r' }),
    ],
  });
  const cal = L.noSpendCalendar(s, L.cycleFor('2026-11-07'), '2026-11-07');
  assert.equal(cal.days.length, 30);
  assert.equal(cal.noSpend, 4); // 2,4,5,6
  assert.equal(cal.streak, 3); // 4,5,6
});

test('categoryCompare compares to same point last cycle', () => {
  const s = stateWith({
    expenses: [exp('a', 100, 'food', '2026-10-05'), exp('b', 300, 'food', '2026-10-25'), exp('c', 150, 'food', '2026-11-04')],
  });
  const [row] = L.categoryCompare(s, '2026-11-10');
  assert.equal(row.now, ILS(150));
  assert.equal(row.before, ILS(100));
  assert.equal(row.prevFull, ILS(400));
  assert.equal(row.delta, ILS(50));
});

test('categoryHabit suggests a yearly saving', () => {
  const s = stateWith({
    expenses: [exp('a', 60, 'food', '2026-11-01'), exp('b', 40, 'food', '2026-11-04'), exp('c', 50, 'food', '2026-11-08')],
  });
  const h = L.categoryHabit(s, 'food', '2026-11-10');
  assert.equal(h.count, 3);
  assert.equal(h.avg, ILS(50));
  assert.equal(h.yearlyIfOneLessPerWeek, ILS(2600));
  assert.equal(L.categoryHabit(s, 'super', '2026-11-10'), null);
});

test('wishState and formatWait', () => {
  const now = 1_000_000_000_000;
  const w = { addedAt: now - 47 * 3600_000, waitHours: 48 };
  assert.equal(L.wishState(w, now).ready, false);
  assert.equal(L.formatWait(L.wishState(w, now).msLeft), 'פחות משעה');
  assert.equal(L.wishState({ ...w, addedAt: now - 49 * 3600_000 }, now).ready, true);
  assert.equal(L.formatWait(30 * 3600_000), 'עוד יום');
  assert.equal(L.formatWait(5 * 3600_000), 'עוד 5 שעות');
  assert.equal(L.formatWait(72 * 3600_000), 'עוד 3 ימים');
});

test('toCSV escapes quotes and starts with BOM for Excel Hebrew', () => {
  const s = stateWith({ expenses: [exp('a', 12.5, 'food', '2026-11-01', { note: 'פיצה "גדולה", עם תוספת' })] });
  const csv = L.toCSV(s);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"פיצה ""גדולה"", עם תוספת"/);
  assert.match(csv, /"12\.50"/);
});

test('weekdayPattern', () => {
  const p = L.weekdayPattern([exp('a', 10, 'food', '2026-11-13'), exp('b', 20, 'food', '2026-11-13'), exp('c', 99, 'misc', '2026-11-13', { recurringId: 'r' })]);
  assert.equal(p[5].total, ILS(30)); // Friday
  assert.equal(p[5].activeDays, 1);
});

/* ---------- store ---------- */
function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), keys: () => [...m.keys()] };
}

test('store round-trips state', () => {
  const st = memStorage();
  const s = stateWith({ expenses: [exp('a', 10, 'food', '2026-11-01', { note: 'קפה' })] });
  assert.equal(S.save(s, st), true);
  const back = S.load(st);
  assert.deepEqual(back.expenses, s.expenses);
  assert.equal(back.settings.cycleDay, 1);
});

test('store keeps a copy of corrupt data and starts fresh', () => {
  const st = memStorage();
  st.setItem(S.STORAGE_KEY, '{not json');
  const s = S.load(st);
  assert.equal(s.expenses.length, 0);
  assert.ok(st.keys().some((k) => k.includes('.broken.')));
});

test('importJSON validates and repairs', () => {
  assert.throws(() => S.importJSON('nope'), /פגום/);
  assert.throws(() => S.importJSON('{"a":1}'), /חסרות/);
  const s = stateWith({ expenses: [exp('a', 10, 'ghost-cat', '2026-11-01'), { id: 'bad', amount: -5, date: 'x' }] });
  const back = S.importJSON(S.exportJSON(s));
  assert.equal(back.expenses.length, 1);
  assert.equal(back.expenses[0].catId, 'misc', 'unknown category falls back to last category');
  assert.equal(back.settings.cycleDay, 1);
  const weird = S.normalize({ categories: [{ id: 'x', name: 'א' }], expenses: [], settings: { cycleDay: 45, alertAt: 7, theme: 'neon' } });
  assert.equal(weird.settings.cycleDay, 28);
  assert.equal(weird.settings.alertAt, 0.8);
  assert.equal(weird.settings.theme, 'auto');
});
