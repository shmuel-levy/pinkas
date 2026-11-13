import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/lib/logic.js';
import * as S from '../src/lib/storage.js';
import * as I from '../src/lib/invest.js';

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
let n = 0;
const exp = (amount, catId, date, note = '') => ({ id: 'e' + n++, amount: ILS(amount), catId, date, note, createdAt: n });

/* ---------- assets ---------- */
test('assets: groups and net worth, old snapshots still work', () => {
  const snap = { assets: { checking: ILS(8000), cash: ILS(500), deposits: ILS(20000), stocks: ILS(40000), gemel: ILS(10000), crypto: 0, hishtalmut: ILS(60000), pension: ILS(150000), other: 0 } };
  assert.deepEqual(L.groupTotals(snap), { liquid: ILS(28500), invest: ILS(50000), longterm: ILS(210000) });
  assert.equal(L.netWorth(snap), ILS(288500));
  const old = { cash: ILS(100), investments: ILS(200), savings: ILS(300) };
  assert.deepEqual(L.groupTotals(old), { liquid: ILS(400), invest: ILS(200), longterm: 0 });
  assert.equal(L.netWorth(old), ILS(600));
});

test('every asset type belongs to a known group', () => {
  const groups = new Set(L.ASSET_GROUPS.map((g) => g.key));
  assert.ok(L.ASSET_TYPES.every((t) => groups.has(t.group)));
  assert.equal(new Set(L.ASSET_TYPES.map((t) => t.key)).size, L.ASSET_TYPES.length);
});

/* ---------- growth ---------- */
test('futureValue: no return = sum of deposits; with return grows', () => {
  assert.equal(L.futureValue({ monthly: ILS(100), years: 10, annualRate: 0 }), ILS(12000));
  const fv = L.futureValue({ monthly: ILS(100), years: 10, annualRate: 0.06 });
  assert.ok(fv > ILS(16300) && fv < ILS(16500), String(fv)); // ≈ ₪16,388
  assert.equal(L.futureValue({ lump: ILS(1000), years: 1, annualRate: 0 }), ILS(1000));
});

/* ---------- story timing ---------- */
test('story becomes available on the first check-in day after the cycle ends', () => {
  assert.equal(L.storyAvailableFrom(L.cycleFor('2026-10-15', 1), 10), '2026-11-10');
  assert.equal(L.storyAvailableFrom(L.cycleFor('2026-10-15', 10), 10), '2026-11-10'); // cycle 10 Oct – 9 Nov
  assert.equal(L.storyAvailableFrom(L.cycleFor('2026-10-20', 15), 10), '2026-12-10'); // cycle ends 15 Nov
});

test('pendingStory: only after the day, only with data, only once', () => {
  const s = stateWith({ settings: { cycleDay: 1, checkInDay: 10 }, expenses: [exp(50, 'food', '2026-10-05')] });
  assert.equal(L.pendingStory(s, '2026-11-09'), null, 'before the 10th');
  assert.equal(L.pendingStory(s, '2026-11-10').start, '2026-10-01');
  s.settings.lastStorySeen = '2026-10-01';
  assert.equal(L.pendingStory(s, '2026-11-20'), null, 'already seen');
  assert.equal(L.pendingStory(stateWith(), '2026-11-20'), null, 'no data');
});

test('monthStory gathers the pieces for the slides', () => {
  const s = stateWith({
    settings: { cycleDay: 1, income: ILS(10000) },
    expenses: [exp(700, 'food', '2026-10-05', 'מסעדה'), exp(40, 'food', '2026-10-06', 'קפה'), exp(40, 'food', '2026-10-09', 'קפה'), exp(1200, 'super', '2026-10-07', 'שופרסל')],
    goals: [{ id: 'g', name: 'טיסה', target: ILS(5000), saved: ILS(1000), createdAt: 1, celebratedAt: 0 }],
    snapshots: [{ id: 'a', period: '2026-10', date: '2026-10-10', income: ILS(10000), assets: { checking: ILS(5000) } }, { id: 'b', period: '2026-11', date: '2026-11-10', income: ILS(10000), assets: { checking: ILS(7000) } }],
  });
  const st = L.monthStory(s, L.cycleFor('2026-10-15', 1), '2026-11-10');
  assert.equal(st.top[0].cat.id, 'super');
  assert.equal(st.biggest.note, 'שופרסל');
  assert.equal(st.topPlace.name, 'קפה');
  assert.ok(st.invest.monthly > 0 && st.invest.monthly % 1000 === 0, 'rounded to ₪10');
  assert.ok(st.invest.y10 > st.invest.deposited10);
  assert.ok(st.invest.y20 > st.invest.y10);
  assert.equal(st.nwChange, ILS(2000));
  assert.equal(st.goal.id, 'g');
  assert.equal(st.report.income, ILS(10000));
});

/* ---------- brokers ---------- */
const profile = (o) => ({ market: 'ta', monthly: ILS(1000), lump: ILS(20000), ...o });

test('broker cost: TA percentage with minimum, monthly fee and offset', () => {
  const ex = I.BROKERS.find((b) => b.id === 'excellence');
  // 13 trades: lump 20,000 × 0.07% = ₪14; monthly 1,000 × 0.07% = ₪0.70 -> min ₪3. 12×3 + 14 = ₪50 commissions.
  // fee ₪15/month offset by that month's commissions: month 1 paid 17 -> 0; others 3 -> 12 × 11 = ₪132
  const c = I.yearlyCost(ex, profile());
  assert.equal(c.commissions, ILS(50));
  assert.equal(c.handling, ILS(132));
  assert.equal(c.total, ILS(182));
  const meitav = I.yearlyCost(I.BROKERS.find((b) => b.id === 'meitav'), profile());
  assert.equal(meitav.handling, ILS(180), 'not offset: full ₪15 × 12');
});

test('broker cost: US minimum in dollars, Blink free trades, unavailable markets', () => {
  const blink = I.BROKERS.find((b) => b.id === 'blink');
  assert.equal(I.yearlyCost(blink, profile({ market: 'ta' })).available, false);
  assert.equal(I.yearlyCost(blink, profile({ market: 'us' })).total, 0, 'within 10 free trades a month');
  const psagot = I.yearlyCost(I.BROKERS.find((b) => b.id === 'psagot'), profile({ market: 'us' }));
  assert.equal(psagot.commissions, 13 * Math.round(6 * I.USD_ILS * 100));
});

test('bank custody makes the bank the most expensive, ranking puts available first', () => {
  const list = I.compareBrokers(profile());
  assert.equal(list[list.length - 1].cost.available, false);
  const avail = list.filter((x) => x.cost.available);
  for (let i = 1; i < avail.length; i++) assert.ok(avail[i - 1].cost.total <= avail[i].cost.total);
  assert.equal(avail[avail.length - 1].broker.id, 'bank');
  assert.ok(list.find((x) => x.broker.id === 'ibi').belowMin === false || list.find((x) => x.broker.id === 'ibi').belowMin === true);
  assert.equal(I.compareBrokers(profile({ lump: ILS(1000) })).find((x) => x.broker.id === 'ibi').belowMin, true, 'IBI asks for ₪15,000 to open');
});

test('pension fees: better rates save real money over 20 years', () => {
  const base = { balance: ILS(150000), monthly: ILS(2500), years: 20 };
  const high = I.pensionFees({ ...base, depositFee: 0.03, savingsFee: 0.003 });
  const good = I.pensionFees({ ...base, ...{ depositFee: I.PENSION_GOOD.deposit, savingsFee: I.PENSION_GOOD.savings } });
  assert.ok(high.paid > good.paid);
  assert.ok(high.endBalance < good.endBalance);
  assert.equal(I.pensionFees({ ...base, depositFee: 0, savingsFee: 0 }).paid, 0);
});

/* ---------- plan (general guidance) ---------- */
test('plan asks for an emergency fund first when liquid money is short', () => {
  const p = I.investPlan({ horizon: 'xlong', goal: 'grow', lump: 0, monthly: ILS(500), market: 'ta' }, { avgSpend: ILS(8000), liquid: ILS(5000) });
  assert.equal(p.notes[0].kind, 'first');
  assert.equal(p.emergency.ok, false);
  assert.ok(p.notes.some((x) => x.kind === 'tax'));
  assert.equal(p.selfDirected, true);
  assert.equal(p.years, 10);
  assert.ok(p.projection[2].value > p.projection[0].value);
});

test('plan for short horizons points to solid options and skips the broker table', () => {
  const p = I.investPlan({ horizon: 'short', goal: 'goal', lump: ILS(10000), monthly: 0, market: 'ta' }, { avgSpend: ILS(5000), liquid: ILS(50000) });
  assert.equal(p.emergency.ok, true);
  assert.equal(p.selfDirected, false);
  assert.ok(p.notes.some((x) => x.kind === 'horizon' && /סולידיים/.test(x.text)));
  assert.ok(!p.notes.some((x) => x.kind === 'tax'));
});

test('store keeps investment answers and goal celebration', () => {
  const s = stateWith({
    invest: { status: 'want', profile: { horizon: 'xlong', goal: 'retire', lump: ILS(1000), monthly: ILS(300), market: 'us' }, broker: 'ibi', pension: { monthly: ILS(2000), depositFee: 0.02, savingsFee: 0.002 } },
    goals: [{ id: 'g', name: 'x', target: 100, saved: 100, createdAt: 1, celebratedAt: 5 }],
    settings: { piggyGoalId: 'g', lastStorySeen: '2026-10-01' },
  });
  const back = S.importJSON(S.exportJSON(s));
  assert.deepEqual(back.invest, s.invest);
  assert.equal(back.goals[0].celebratedAt, 5);
  assert.equal(back.settings.piggyGoalId, 'g');
  assert.equal(back.settings.lastStorySeen, '2026-10-01');
  const bad = S.normalize({ categories: [{ id: 'a', name: 'א' }], expenses: [], invest: { status: 'rich', pension: { depositFee: 9 } }, settings: { piggyGoalId: 'ghost' } });
  assert.equal(bad.invest.status, null);
  assert.equal(bad.invest.pension.depositFee, 0.06, 'capped at the legal maximum');
  assert.equal(bad.settings.piggyGoalId, null);
});
