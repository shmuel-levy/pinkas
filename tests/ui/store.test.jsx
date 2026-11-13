// Redux store: reducers, persistence, and the thunks that wrap the tested logic.
import { describe, expect, it } from 'vitest';
import * as L from '../../src/lib/logic.js';
import { STORAGE_KEY, defaultState } from '../../src/lib/storage.js';
import { makeStore } from '../../src/store/index.js';
import { D, addCategoryWithColor } from '../../src/store/dataSlice.js';
import { U } from '../../src/store/uiSlice.js';

const fresh = () => makeStore({ preloaded: { ...defaultState(), onboarded: true } });
const t = L.todayISO();

describe('data slice', () => {
  it('saves every change under the same key as earlier versions', () => {
    const store = fresh();
    store.dispatch(D.addExpense({ amount: 1200, catId: store.getState().data.categories[0].id, note: 'x', date: t }));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved.expenses).toHaveLength(1);
    expect(saved.expenses[0].id).toBeTruthy();
  });

  it('a standing order records the expense and the monthly rule together, and undo removes both', () => {
    const store = fresh();
    const catId = store.getState().data.categories[0].id;
    const action = D.addStandingExpense({ draft: { amount: 4990, catId, note: 'נטפליקס', date: t }, today: t });
    store.dispatch(action);
    let s = store.getState().data;
    expect(s.recurring).toHaveLength(1);
    expect(s.expenses.every((e) => e.recurringId === action.payload.recurring.id)).toBe(true);
    store.dispatch(D.undoStanding(action.payload.recurring.id));
    s = store.getState().data;
    expect(s.recurring).toHaveLength(0);
    expect(s.expenses).toHaveLength(0);
  });

  it('a deposit that reaches the target marks the goal as celebrated once', () => {
    const store = fresh();
    store.dispatch(D.addGoal({ name: 'מחשב', target: 10000, saved: 9000 }));
    const id = store.getState().data.goals[0].id;
    store.dispatch(D.depositGoal({ id, amount: 1000 }));
    const g = store.getState().data.goals[0];
    expect(g.saved).toBe(10000);
    expect(g.celebratedAt).toBeGreaterThan(0);
  });

  it('removing a skipped purchase takes it back out of its goal', () => {
    const store = fresh();
    store.dispatch(D.addGoal({ name: 'טיסה', target: 50000 }));
    const goalId = store.getState().data.goals[0].id;
    store.dispatch(D.addResisted({ name: 'סושי', amount: 9000, date: t, goalId }));
    expect(store.getState().data.goals[0].saved).toBe(9000);
    store.dispatch(D.removeResisted(store.getState().data.resisted[0].id));
    expect(store.getState().data.goals[0].saved).toBe(0);
  });

  it('a spread (yearly insurance) creates equal monthly shares, and removing it removes them', () => {
    const store = fresh();
    const catId = store.getState().data.categories[0].id;
    store.dispatch(D.upsertSpread({ id: 'sp1', name: 'ביטוח רכב', total: 360000, months: 12, start: t, catId, createdAt: 1 }));
    const shares = store.getState().data.expenses.filter((e) => e.spreadId === 'sp1');
    expect(shares).toHaveLength(12);
    expect(L.sumBy(shares)).toBe(360000);
    store.dispatch(D.removeSpread('sp1'));
    expect(store.getState().data.expenses).toHaveLength(0);
  });

  it('new categories get the next palette colour', () => {
    const store = fresh();
    store.dispatch(addCategoryWithColor({ name: 'ילדים', budget: 50000 }));
    const c = store.getState().data.categories.at(-1);
    expect(c).toMatchObject({ name: 'ילדים', budget: 50000, archived: false });
    expect(c.color).toMatch(/^#/);
  });

  it('a visit is recorded once per day', () => {
    const store = fresh();
    store.dispatch(D.recordVisit(t));
    store.dispatch(D.recordVisit(t));
    expect(store.getState().data.visits).toEqual([t]);
  });
});

describe('ui slice', () => {
  it('jumping to a category opens the ledger filtered to it', () => {
    const store = fresh();
    store.dispatch(U.openSub({ sub: 'insights' }));
    store.dispatch(U.ledgerCategory('c1'));
    const ui = store.getState().ui;
    expect(ui).toMatchObject({ tab: 'ledger', sub: null });
    expect(ui.ledger).toMatchObject({ cat: 'c1', offset: 0, day: null });
  });

  it('the first-run questionnaire survives tab changes; other questionnaires do not', () => {
    const store = fresh();
    store.dispatch(U.startQuiz({ id: 'start' }));
    store.dispatch(U.goTab('save'));
    expect(store.getState().ui.quiz?.id).toBe('start');
    store.dispatch(U.startQuiz({ id: 'budget' }));
    store.dispatch(U.goTab('home'));
    expect(store.getState().ui.quiz).toBeNull();
  });
});
