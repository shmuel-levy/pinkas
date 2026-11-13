// Everything פנקס saves lives in this slice. Reducers stay pure: ids and timestamps are created in
// `prepare`, and all money math comes from the tested functions in lib/logic.js.
import { createSlice } from '@reduxjs/toolkit';
import * as L from '../lib/logic.js';
import { PALETTE } from '../lib/storage.js';

const now = () => Date.now();
const withId = (obj) => ({ payload: { id: L.uid(), createdAt: now(), ...obj } });
const byId = (list, id) => list.find((x) => x.id === id);

const dataSlice = createSlice({
  name: 'data',
  initialState: null, // filled from storage in store/index.js
  reducers: {
    replaceAll: (_, { payload }) => payload,

    /* settings */
    setSetting: (s, { payload: { key, value } }) => { s.settings[key] = value; },
    mergeSettings: (s, { payload }) => { Object.assign(s.settings, payload); },
    markTourSeen: (s, { payload: key }) => { s.settings.toursSeen = { ...s.settings.toursSeen, [key]: true }; },
    resetTours: (s) => { s.settings.toursSeen = {}; },
    setOnboarded: (s) => { s.onboarded = true; },

    /* expenses */
    addExpense: { reducer: (s, { payload }) => { s.expenses.push(payload); }, prepare: withId },
    updateExpense: (s, { payload: { id, changes } }) => { Object.assign(byId(s.expenses, id) || {}, changes); },
    removeExpense: (s, { payload: id }) => { s.expenses = s.expenses.filter((e) => e.id !== id); },
    restoreExpense: (s, { payload }) => { s.expenses.push(payload); },

    /* incomes */
    addIncome: { reducer: (s, { payload }) => { s.incomes.push(payload); }, prepare: withId },
    updateIncome: (s, { payload: { id, changes } }) => { Object.assign(byId(s.incomes, id) || {}, changes); },
    removeIncome: (s, { payload: id }) => { s.incomes = s.incomes.filter((i) => i.id !== id); },
    restoreIncome: (s, { payload }) => { s.incomes.push(payload); },

    /* an expense that is also a monthly standing order */
    addStandingExpense: {
      reducer: (s, { payload: { expense, recurring, today } }) => {
        s.recurring.push(recurring);
        s.expenses.push({ ...expense, recurringId: recurring.id });
        const r = L.applyRecurring(s, today); // recorded late? fill in the months since
        s.expenses = r.state.expenses;
        s.recurring = r.state.recurring;
      },
      prepare: ({ draft, today }) => ({
        payload: { expense: { id: L.uid(), createdAt: now(), ...draft }, recurring: L.recurringFromExpense(draft), today },
      }),
    },
    undoStanding: (s, { payload: recurringId }) => {
      s.expenses = s.expenses.filter((e) => e.recurringId !== recurringId);
      s.recurring = s.recurring.filter((r) => r.id !== recurringId);
    },

    /* recurring (fixed) charges */
    addRecurring: { reducer: (s, { payload }) => { s.recurring.push(payload); }, prepare: (item) => ({ payload: { id: L.uid(), active: true, lastMonth: null, ...item } }) },
    updateRecurring: (s, { payload: { id, changes } }) => { Object.assign(byId(s.recurring, id) || {}, changes); },
    removeRecurring: (s, { payload: id }) => { s.recurring = s.recurring.filter((r) => r.id !== id); },
    applyRecurring: (s, { payload: today }) => {
      const r = L.applyRecurring(s, today);
      if (r.added.length) {
        s.expenses = r.state.expenses;
        s.recurring = r.state.recurring;
      }
    },

    /* insurance & annual expenses spread over months */
    upsertSpread: (s, { payload }) => {
      const i = s.spreads.findIndex((x) => x.id === payload.id);
      if (i >= 0) s.spreads[i] = payload;
      else s.spreads.push(payload);
      s.expenses = L.syncSpreads(s).expenses;
    },
    removeSpread: (s, { payload: id }) => {
      s.spreads = s.spreads.filter((x) => x.id !== id);
      s.expenses = L.syncSpreads(s).expenses;
    },
    syncSpreads: (s) => {
      if (s.spreads.length || s.expenses.some((e) => e.spreadId)) s.expenses = L.syncSpreads(s).expenses;
    },

    /* goals & the piggy */
    addGoal: { reducer: (s, { payload }) => { s.goals.push(payload); }, prepare: (g) => withId({ saved: 0, celebratedAt: 0, ...g }) },
    updateGoal: (s, { payload: { id, changes } }) => { Object.assign(byId(s.goals, id) || {}, changes); },
    removeGoal: (s, { payload: id }) => { s.goals = s.goals.filter((g) => g.id !== id); },
    restoreGoal: (s, { payload: { goal, index } }) => { s.goals.splice(index, 0, goal); },
    depositGoal: {
      reducer: (s, { payload: { id, amount, at } }) => {
        const g = byId(s.goals, id);
        if (!g) return;
        g.saved += amount;
        if (g.saved >= g.target && !g.celebratedAt) g.celebratedAt = at;
      },
      prepare: ({ id, amount }) => ({ payload: { id, amount, at: now() } }),
    },

    /* "I skipped it" */
    addResisted: {
      reducer: (s, { payload }) => {
        s.resisted.push(payload);
        const g = payload.goalId && byId(s.goals, payload.goalId);
        if (g) {
          g.saved += payload.amount;
          if (g.saved >= g.target && !g.celebratedAt) g.celebratedAt = payload.createdAt;
        }
      },
      prepare: withId,
    },
    removeResisted: (s, { payload: id }) => {
      const r = byId(s.resisted, id);
      if (!r) return;
      s.resisted = s.resisted.filter((x) => x.id !== id);
      const g = r.goalId && byId(s.goals, r.goalId);
      if (g) g.saved = Math.max(0, g.saved - r.amount);
    },
    restoreResisted: (s, { payload }) => {
      s.resisted.push(payload);
      const g = payload.goalId && byId(s.goals, payload.goalId);
      if (g) g.saved += payload.amount;
    },

    /* wishlist (cooling-off) */
    addWish: { reducer: (s, { payload }) => { s.wishlist.push(payload); }, prepare: (w) => ({ payload: { id: L.uid(), addedAt: now(), status: 'waiting', ...w } }) },
    setWishStatus: (s, { payload: { id, status } }) => { const w = byId(s.wishlist, id); if (w) w.status = status; },
    removeWish: (s, { payload: id }) => { s.wishlist = s.wishlist.filter((w) => w.id !== id); },

    /* categories */
    addCategory: {
      reducer: (s, { payload }) => { s.categories.push(payload); },
      prepare: ({ name, budget, id }) => ({ payload: { id: id || L.uid(), name, budget: budget || 0, color: null, archived: false } }),
    },
    updateCategory: (s, { payload: { id, changes } }) => { Object.assign(byId(s.categories, id) || {}, changes); },
    removeCategory: (s, { payload: id }) => { s.categories = s.categories.filter((c) => c.id !== id); },
    restoreCategory: (s, { payload: { cat, index } }) => { s.categories.splice(index, 0, cat); },
    cycleColor: (s, { payload: id }) => {
      const c = byId(s.categories, id);
      if (c) c.color = PALETTE[(PALETTE.indexOf(c.color) + 1) % PALETTE.length];
    },

    /* monthly check-in */
    upsertSnapshot: (s, { payload }) => {
      s.snapshots = [...s.snapshots.filter((x) => x.period !== payload.period), payload];
    },
    removeSnapshot: (s, { payload: period }) => { s.snapshots = s.snapshots.filter((x) => x.period !== period); },

    /* places, investments, balances, streak */
    setPlacePref: (s, { payload: { key, pref } }) => { s.placePrefs[key] = { ...(s.placePrefs[key] || {}), ...pref }; },
    setInvest: (s, { payload }) => { Object.assign(s.invest, payload); },
    resetInvest: (s) => { s.invest = { status: null, profile: null, broker: null, pension: null }; },
    setBalanceAnchor: { reducer: (s, { payload }) => { s.balanceAnchor = payload; }, prepare: ({ checking, cash }) => ({ payload: { checking: checking || 0, cash: cash || 0, at: now() } }) },
    recordVisit: (s, { payload: today }) => {
      if (!s.visits.includes(today)) s.visits = [...s.visits, today].slice(-500);
    },
  },
});

// Categories added at runtime get the next palette colour
export const addCategoryWithColor = (cat) => (dispatch, getState) => {
  const color = PALETTE[getState().data.categories.length % PALETTE.length];
  const action = dataSlice.actions.addCategory(cat);
  action.payload.color = color;
  dispatch(action);
};

export const D = dataSlice.actions;
export default dataSlice.reducer;
