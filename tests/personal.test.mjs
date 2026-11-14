// The personal layer: a day in detail, first steps, greeting, and the saved profile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayDetails, firstSteps, greeting, personalLine, showFirstSteps } from '../src/lib/personal.js';
import { defaultState, normalize } from '../src/lib/storage.js';

const T = '2026-11-14';
const fmt = (a) => `₪${Math.round(a / 100)}`;
function state() {
  const s = defaultState();
  s.onboarded = true;
  const food = s.categories.find((c) => c.name === 'אוכל בחוץ');
  s.expenses = [
    { id: 'a', amount: 4000, catId: food.id, note: 'ארומה', date: T, createdAt: 2 },
    { id: 'b', amount: 2000, catId: s.categories[1].id, note: 'שופרסל', date: T, createdAt: 3 },
    { id: 'c', amount: 9900, catId: food.id, note: 'נטפליקס', date: '2026-11-05', createdAt: 1, recurringId: 'r1' },
  ];
  s.incomes = [{ id: 'i', amount: 100000, date: T, note: '', source: 'משכורת', createdAt: 4 }];
  s.recurring = [{ id: 'r2', name: 'חדר כושר', amount: 19900, catId: food.id, day: 20, active: true, startMonth: '2026-11', lastMonth: null }];
  s.resisted = [{ id: 'x', name: 'סושי', amount: 9000, date: T, goalId: null, catId: food.id, createdAt: 1 }];
  s.settings.monthlyBudget = 300000;
  s.visits = [T];
  return s;
}

test('a day: entries, totals, categories, skipped purchases', () => {
  const d = dayDetails(state(), T, T);
  assert.equal(d.expenses.length, 2);
  assert.equal(d.spent, 6000);
  assert.equal(d.income, 100000);
  assert.equal(d.net, 94000);
  assert.equal(d.byCat[0].amount, 4000);
  assert.equal(d.resisted.length, 1);
  assert.equal(d.noSpend, false);
  assert.equal(d.opened, true);
  assert.equal(d.isToday, true);
  // 3,000 a month over 30 days = 100 a day; spent 60 → 40 under
  assert.equal(d.dailyShare, 10000);
  assert.equal(d.vsShare, -4000);
});

test('a day with only a standing order still counts as a no-spend day', () => {
  const d = dayDetails(state(), '2026-11-05', T);
  assert.equal(d.noSpend, true);
  assert.equal(d.fixed.length, 1);
});

test('a future day shows the standing orders planned for it', () => {
  const d = dayDetails(state(), '2026-11-20', T);
  assert.equal(d.future, true);
  assert.equal(d.upcoming.length, 1);
  assert.equal(d.upcoming[0].item.name, 'חדר כושר');
  assert.equal(d.vsShare, null);
});

test('first steps track what is done, and only beginners/some see them', () => {
  const s = state();
  const steps = firstSteps(s);
  assert.deepEqual(steps.filter((x) => x.done).map((x) => x.key), ['expense', 'budget']);
  assert.equal(showFirstSteps(s), false); // no level yet
  s.settings.level = 'beginner';
  assert.equal(showFirstSteps(s), true);
  s.settings.level = 'pro';
  assert.equal(showFirstSteps(s), false);
  s.settings.level = 'some';
  s.settings.stepsDismissed = true;
  assert.equal(showFirstSteps(s), false);
});

test('greeting follows the clock', () => {
  assert.equal(greeting(8), 'בוקר טוב');
  assert.equal(greeting(14), 'צהריים טובים');
  assert.equal(greeting(19), 'ערב טוב');
  assert.equal(greeting(2), 'לילה טוב');
});

test('the personal line follows what matters to you', () => {
  const s = state();
  s.goals = [{ id: 'g', name: 'טיסה', target: 500000, saved: 100000, celebratedAt: 0 }];
  s.settings.focus = 'save';
  assert.match(personalLine(s, T, fmt), /עוד ₪4000 לטיסה/);
  s.settings.focus = 'understand';
  assert.match(personalLine(s, T, fmt), /החודש הכי הרבה הלך על/);
  s.expenses = [];
  assert.match(personalLine(s, T, fmt), /ההוצאה הראשונה/);
});

test('the profile survives saving and loading; junk is dropped', () => {
  const s = state();
  Object.assign(s.settings, { name: '  דנה  ', level: 'beginner', focus: 'save', tipsSeen: { ledger: true, 'bad key!': true }, stepsDismissed: true });
  const back = normalize(JSON.parse(JSON.stringify(s)));
  assert.equal(back.settings.name, 'דנה');
  assert.equal(back.settings.level, 'beginner');
  assert.equal(back.settings.focus, 'save');
  assert.deepEqual(back.settings.tipsSeen, { ledger: true });
  assert.equal(back.settings.stepsDismissed, true);
  const junk = normalize({ ...s, settings: { level: 'guru', focus: 7, name: 42 } });
  assert.equal(junk.settings.level, '');
  assert.equal(junk.settings.focus, '');
  assert.equal(junk.settings.name, '');
});
