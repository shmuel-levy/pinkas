// The personal layer: one day in detail, first steps for new users, and a greeting that knows who you are.
// Pure functions over the saved state (no DOM), tested in Node like logic.js.
import * as L from './logic.js';

const byNewest = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);

/* ---------- one day, everything about it ---------- */
export function dayDetails(state, date, today) {
  const cycle = L.cycleFor(date, state.settings.cycleDay);
  const expenses = state.expenses.filter((e) => e.date === date).sort(byNewest);
  const incomes = (state.incomes || []).filter((i) => i.date === date).sort(byNewest);
  const variable = expenses.filter((e) => !e.recurringId && !e.spreadId);
  const fixed = expenses.filter((e) => e.recurringId || e.spreadId);
  const spent = L.sumBy(expenses);
  const income = L.sumBy(incomes);
  const catMap = new Map();
  for (const e of expenses) catMap.set(e.catId, (catMap.get(e.catId) || 0) + e.amount);
  const byCat = [...catMap.entries()]
    .map(([catId, amount]) => ({ cat: state.categories.find((c) => c.id === catId), amount }))
    .filter((x) => x.cat)
    .sort((a, b) => b.amount - a.amount);
  // standing orders still to come on that day
  const upcoming = date >= today
    ? L.upcomingRecurring(state.recurring, cycle, date === today ? L.addDays(today, -1) : today)
      .filter((u) => u.date === date && !expenses.some((e) => e.recurringId === u.item.id))
    : [];
  // the even daily share of the monthly budget, to put the day in context
  const budget = L.overallBudget(state);
  const cycleDays = L.dayDiff(cycle.start, cycle.end);
  const dailyShare = budget && cycleDays ? Math.round(budget / cycleDays) : 0;
  const variableSpent = L.sumBy(variable);
  return {
    date,
    cycle,
    isToday: date === today,
    future: date > today,
    expenses,
    incomes,
    variable,
    fixed,
    spent,
    variableSpent,
    income,
    net: income - spent,
    byCat,
    upcoming,
    resisted: (state.resisted || []).filter((r) => r.date === date),
    noSpend: date <= today && variable.length === 0,
    opened: (state.visits || []).includes(date),
    dailyShare,
    // how the day compares with an even split of the month (only for days that are over or today)
    vsShare: dailyShare && date <= today ? variableSpent - dailyShare : null,
  };
}

/* ---------- first steps for someone new ---------- */
export function firstSteps(state, { installed = false } = {}) {
  return [
    { key: 'expense', done: state.expenses.some((e) => !e.recurringId && !e.spreadId), title: 'לרשום הוצאה ראשונה', text: 'קפה, סופר, דלק — כל דבר. חמש שניות.' },
    { key: 'budget', done: !!state.settings.monthlyBudget, title: 'להגדיר תקציב חודשי', text: '3 שאלות, ומקבלים כמה מותר להוציא כל יום.' },
    { key: 'goal', done: state.goals.length > 0, title: 'לבחור מטרה לחיסכון', text: 'טיסה, מחשב, כרית ביטחון — חוסכים בשביל משהו.' },
    { key: 'checkin', done: state.snapshots.length > 0, title: 'צ׳ק־אין ראשון', text: 'כמה יש לך בכל מקום. ככה רואים את ההון גדל.' },
    { key: 'install', done: installed || !!state.settings.installHintDismissed, title: 'להוסיף למסך הבית', text: 'ככה זה נפתח כמו אפליקציה, גם בלי אינטרנט.' },
  ];
}

// Should the first-steps card show? Beginners and "some experience" get it until done or dismissed.
export function showFirstSteps(state, opts) {
  const lv = state.settings.level;
  if (state.settings.stepsDismissed || !(lv === 'beginner' || lv === 'some')) return false;
  return firstSteps(state, opts).some((s) => !s.done);
}

/* ---------- greeting ---------- */
export function greeting(hour) {
  if (hour >= 5 && hour < 12) return 'בוקר טוב';
  if (hour >= 12 && hour < 17) return 'צהריים טובים';
  if (hour >= 17 && hour < 22) return 'ערב טוב';
  return 'לילה טוב';
}

// One caring sentence, picked from what matters to this person right now
export function personalLine(state, today, format) {
  const focus = state.settings.focus;
  const sum = L.cycleSummary(state, today);
  const o = sum.overall;
  const goal = state.goals.find((g) => g.id === state.settings.piggyGoalId && g.saved < g.target) || state.goals.find((g) => g.saved < g.target);
  const todaySpent = L.sumBy(state.expenses.filter((e) => e.date === today && !e.recurringId && !e.spreadId));
  if (!state.expenses.length) return 'בוא נתחיל: לוחצים על + ורושמים את ההוצאה הראשונה.';
  if (focus === 'save' && goal) return `עוד ${format(goal.target - goal.saved)} ל${goal.name}. כל ויתור מקרב.`;
  if (focus === 'save') return 'אין עדיין מטרה לחיסכון. כדאי לבחור אחת — קל יותר לחסוך בשביל משהו.';
  if (focus === 'invest') return 'בלשונית ההשקעות מחכה לך תוכנית לפי הסכומים שלך.';
  if (focus === 'understand') {
    const top = L.categoryShares(state, sum.cycle)[0];
    if (top) return `החודש הכי הרבה הלך על ${top.cat.name}: ${Math.round(top.share * 100)}% מההוצאות.`;
  }
  if (o.hasBudget && state.settings.monthlyBudget) {
    if (o.left < 0) return 'החודש כבר מעבר לתקציב. לא נורא — מה שחשוב זה מה עושים מכאן.';
    if (!todaySpent) return 'היום עוד לא הוצאת כלום. אם זה יישאר ככה — יום ירוק.';
    return 'הכל בשליטה. ממשיכים ככה.';
  }
  return todaySpent ? `היום הוצאת ${format(todaySpent)}.` : 'היום עוד לא נרשמו הוצאות.';
}
