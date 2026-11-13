import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../app/js/logic.js';
import * as S from '../app/js/store.js';

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
const exp = (amount, catId, date, note = '', extra = {}) => ({ id: 'e' + n++, amount: ILS(amount), catId, date, note, createdAt: n, ...extra });

/* ---------- places ---------- */
test('a place is remembered after two expenses with the same name', () => {
  const one = [exp(14, 'food', '2026-11-01', 'ארומה')];
  assert.equal(L.learnPlaces(one).length, 0);
  const two = [...one, exp(14, 'food', '2026-11-03', '  ארומה ')];
  const [p] = L.learnPlaces(two);
  assert.equal(p.key, 'ארומה');
  assert.equal(p.name, 'ארומה');
  assert.equal(p.count, 2);
  assert.equal(p.catId, 'food');
  assert.equal(p.usual, ILS(14), 'same amount twice -> usual amount suggested');
});

test('place category follows the majority, unless the user pinned one', () => {
  const list = [exp(50, 'super', '2026-11-01', 'AM:PM'), exp(20, 'food', '2026-11-02', 'am:pm'), exp(30, 'super', '2026-11-03', 'AM:PM')];
  const [p] = L.learnPlaces(list);
  assert.equal(p.key, 'am:pm');
  assert.equal(p.catId, 'super');
  assert.equal(p.usual, null, 'different amounts -> no usual amount');
  assert.equal(L.learnPlaces(list, { 'am:pm': { catId: 'food' } })[0].catId, 'food');
  assert.equal(L.learnPlaces(list, { 'am:pm': { hidden: true } }).length, 0);
});

test('recurring entries and empty notes are not places', () => {
  const list = [exp(50, 'misc', '2026-11-01', 'נטפליקס', { recurringId: 'r' }), exp(50, 'misc', '2026-12-01', 'נטפליקס', { recurringId: 'r' }), exp(5, 'food', '2026-11-01', ''), exp(5, 'food', '2026-11-02', ' ')];
  assert.equal(L.learnPlaces(list).length, 0);
});

test('matchPlaces: prefix matches first, then contains', () => {
  const places = L.learnPlaces([
    exp(1, 'food', '2026-11-01', 'קפה ארומה'), exp(1, 'food', '2026-11-02', 'קפה ארומה'),
    exp(1, 'food', '2026-11-01', 'ארומה'), exp(1, 'food', '2026-11-02', 'ארומה'), exp(1, 'food', '2026-11-03', 'ארומה'),
    exp(1, 'super', '2026-11-01', 'שופרסל'), exp(1, 'super', '2026-11-02', 'שופרסל'),
  ]);
  assert.deepEqual(L.matchPlaces(places, 'ארו').map((p) => p.name), ['ארומה', 'קפה ארומה']);
  assert.deepEqual(L.matchPlaces(places, 'שופ').map((p) => p.name), ['שופרסל']);
  assert.equal(L.matchPlaces(places, '').length, 3);
  assert.equal(L.findPlace(places, ' שופרסל ').catId, 'super');
  assert.equal(L.findPlace(places, 'שופ'), null);
});

/* ---------- check-in ---------- */
test('check-in period flips on the check-in day', () => {
  assert.equal(L.checkInPeriod('2026-11-09', 10), '2026-10');
  assert.equal(L.checkInPeriod('2026-11-10', 10), '2026-11');
  assert.equal(L.checkInPeriod('2027-01-03', 10), '2026-12');
});

test('check-in is due until a snapshot exists for the period', () => {
  const s = stateWith({ settings: { checkInDay: 10 } });
  let st = L.checkInStatus(s, '2026-11-12');
  assert.equal(st.due, true);
  assert.equal(st.date, '2026-11-10');
  s.snapshots = [{ id: 'a', period: '2026-11', date: '2026-11-10', income: ILS(14000), cash: ILS(8000), investments: ILS(50000), savings: 0 }];
  st = L.checkInStatus(s, '2026-11-30');
  assert.equal(st.due, false);
  assert.equal(L.netWorth(st.snap), ILS(58000));
  assert.equal(L.checkInStatus(s, '2026-12-10').due, true);
});

test('income for a cycle comes from check-ins inside it, else from settings', () => {
  const s = stateWith({ settings: { income: ILS(10000), cycleDay: 1 } });
  const nov = L.cycleFor('2026-11-15', 1);
  assert.deepEqual(L.incomeForCycle(s, nov), { amount: ILS(10000), source: 'setting' });
  s.snapshots = [{ id: 'a', period: '2026-11', date: '2026-11-10', income: ILS(14500), cash: 0, investments: 0, savings: 0 }];
  assert.deepEqual(L.incomeForCycle(s, nov), { amount: ILS(14500), source: 'checkin' });
  s.settings.income = 0;
  assert.equal(L.incomeForCycle(s, L.cycleFor('2026-10-15', 1)).source, 'none');
});

test('net worth series is sorted by month', () => {
  const series = L.netWorthSeries([
    { period: '2026-11', cash: 3, investments: 4, savings: 0 },
    { period: '2026-09', cash: 1, investments: 1, savings: 1 },
  ]);
  assert.deepEqual(series.map((x) => [x.period, x.total]), [['2026-09', 3], ['2026-11', 7]]);
});

/* ---------- report & tips ---------- */
test('monthly report: income vs expenses, savings rate, net worth change', () => {
  const s = stateWith({
    settings: { cycleDay: 1 },
    expenses: [exp(700, 'food', '2026-10-05', 'מסעדה'), exp(1000, 'super', '2026-10-06'), exp(4000, 'misc', '2026-10-01', 'שכירות', { recurringId: 'r' }), exp(900, 'super', '2026-09-10')],
    snapshots: [
      { id: 'a', period: '2026-10', date: '2026-10-10', income: ILS(10000), cash: ILS(5000), investments: ILS(20000), savings: 0 },
      { id: 'b', period: '2026-11', date: '2026-11-10', income: ILS(10000), cash: ILS(6000), investments: ILS(21000), savings: 0 },
    ],
  });
  const r = L.monthlyReport(s, L.cycleFor('2026-10-15', 1), '2026-11-12');
  assert.equal(r.complete, true);
  assert.equal(r.income, ILS(10000));
  assert.equal(r.spent, ILS(5700));
  assert.equal(r.fixed, ILS(4000));
  assert.equal(r.left, ILS(4300));
  assert.equal(Math.round(r.rate * 100), 43);
  assert.equal(r.prevSpent, ILS(900));
  assert.equal(r.netChange, ILS(2000));
  assert.equal(r.byCat[0].cat.id, 'misc');
  assert.equal(r.byCat.find((x) => x.cat.id === 'food').over, ILS(100));
  assert.ok(r.tips.some((t) => t.kind === 'over' && t.title.includes('אוכל בחוץ')));
  assert.ok(r.wins.some((w) => w.includes('השווי')));
});

test('tips: frequent place, jump vs last cycle, subscriptions, low savings rate', () => {
  const coffee = Array.from({ length: 8 }, (_, i) => exp(18, 'food', `2026-10-${String(i + 2).padStart(2, '0')}`, 'קפה'));
  const s = stateWith({
    settings: { cycleDay: 1, income: ILS(3000) },
    categories: [
      { id: 'food', name: 'אוכל בחוץ', budget: 0, color: '#B5532C', archived: false },
      { id: 'super', name: 'סופר', budget: 0, color: '#5B7A4E', archived: false },
      { id: 'misc', name: 'אחר', budget: 0, color: '#6B6B5A', archived: false },
    ],
    expenses: [...coffee, exp(400, 'super', '2026-09-05'), exp(1200, 'super', '2026-10-05'), exp(1500, 'misc', '2026-10-06')],
    recurring: [
      { id: 'r1', name: 'נטפליקס', amount: ILS(60), catId: 'misc', day: 14, startMonth: '2026-08', lastMonth: '2026-11', active: true },
      { id: 'r2', name: 'ספוטיפיי', amount: ILS(20), catId: 'misc', day: 3, startMonth: '2026-08', lastMonth: '2026-11', active: true },
    ],
  });
  const tips = L.improvementTips(s, L.cycleFor('2026-10-15', 1), '2026-11-12', 10);
  const kinds = tips.map((t) => t.kind);
  assert.ok(kinds.includes('place'), 'coffee 8 times');
  assert.equal(tips.find((t) => t.kind === 'place').saving, ILS(72));
  assert.ok(kinds.includes('jump'), 'supermarket 400 -> 1200');
  assert.equal(tips.find((t) => t.kind === 'jump').saving, ILS(800));
  assert.ok(kinds.includes('subs'));
  assert.ok(kinds.includes('rate'), 'spent 2844 of 3000');
  // sorted by saving, default max 4
  const top = L.improvementTips(s, L.cycleFor('2026-10-15', 1), '2026-11-12');
  assert.ok(top.length <= 4);
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].saving >= top[i].saving);
});

test('tips skip big necessary shops and do not repeat a category', () => {
  // 8 × ₪400 = ₪3,200 against a ₪1,500 budget: ₪1,700 over, ~5 visits
  const groceries = Array.from({ length: 8 }, (_, i) => exp(400, 'super', `2026-10-${String(i * 3 + 2).padStart(2, '0')}`, 'מכולת'));
  const s = stateWith({ settings: { cycleDay: 1 }, expenses: [...groceries, exp(500, 'super', '2026-09-05')] });
  const tips = L.improvementTips(s, L.cycleFor('2026-10-15', 1), '2026-11-12', 10);
  assert.ok(!tips.some((t) => t.kind === 'place'), 'grocery store (avg ₪280) is not a "habit"');
  const superTips = tips.filter((t) => t.title.startsWith('סופר'));
  assert.equal(superTips.length, 1, 'over-budget and jump for the same category are merged');
  assert.equal(superTips[0].kind, 'over');
  assert.match(superTips[0].detail, /תקרה שבועית/, 'a big gap suggests a weekly cap, not "N times less"');
});

test('tips are empty for a calm month', () => {
  const s = stateWith({ settings: { cycleDay: 1 }, expenses: [exp(30, 'food', '2026-10-05'), exp(200, 'super', '2026-10-06')] });
  const tips = L.improvementTips(s, L.cycleFor('2026-10-15', 1), '2026-10-20');
  assert.deepEqual(tips, []);
});

test('pending report appears once the previous cycle has data and is unseen', () => {
  const s = stateWith({ settings: { cycleDay: 10 }, expenses: [exp(30, 'food', '2026-10-20')] });
  const c = L.pendingReport(s, '2026-11-12');
  assert.equal(c.start, '2026-10-10');
  s.settings.lastReportSeen = '2026-10-10';
  assert.equal(L.pendingReport(s, '2026-11-12'), null);
  assert.equal(L.pendingReport(stateWith(), '2026-11-12'), null);
});

/* ---------- calendar reminder ---------- */
test('reminder ICS repeats monthly with an alarm and next occurrence', () => {
  const ics = L.reminderICS({ checkInDay: 10, cycleDay: 1, url: 'https://x.test/', now: new Date(2026, 10, 12, 8) });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /RRULE:FREQ=MONTHLY;BYMONTHDAY=10/);
  assert.match(ics, /DTSTART:20261210T090000/, '10 Nov passed -> starts 10 Dec');
  assert.match(ics, /DTSTART:20261201T090000/, 'report reminder on cycle day');
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  const same = L.reminderICS({ checkInDay: 10, cycleDay: 10, now: new Date(2026, 10, 5) });
  assert.equal((same.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(same, /DTSTART:20261110T090000/);
});

/* ---------- store migration ---------- */
test('old backups gain the new fields with safe defaults', () => {
  const old = { categories: [{ id: 'x', name: 'א' }], expenses: [], settings: { cycleDay: 3 } };
  const s = S.normalize(old);
  assert.deepEqual(s.snapshots, []);
  assert.deepEqual(s.placePrefs, {});
  assert.equal(s.settings.checkInDay, 10);
  assert.equal(s.settings.lastReportSeen, '');
  const withData = S.normalize({
    ...old,
    snapshots: [{ period: '2026-11', date: '2026-11-10', income: 100, cash: 5, investments: 'bad' }, { period: 'nope' }],
    placePrefs: { 'ארומה': { catId: 'x', hidden: false }, bad: 7, 'שופרסל': { catId: 'ghost' } },
  });
  assert.equal(withData.snapshots.length, 1);
  // old fields migrate into the asset map: cash -> עו״ש, bad investments -> 0
  assert.equal(withData.snapshots[0].assets.checking, 5);
  assert.equal(withData.snapshots[0].assets.stocks, 0);
  assert.equal(L.netWorth(withData.snapshots[0]), 5);
  assert.deepEqual(withData.placePrefs['ארומה'], { catId: 'x', hidden: false });
  assert.equal(withData.placePrefs.bad, undefined);
  assert.deepEqual(withData.placePrefs['שופרסל'], { catId: null, hidden: false });
});
