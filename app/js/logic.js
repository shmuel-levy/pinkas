// פנקס — pure logic. No DOM here, so everything is testable in Node.
// All money is stored as integer agorot (1 ₪ = 100) to avoid float drift.

export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const MONTHS_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const WEEKDAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const pad = (n) => String(n).padStart(2, '0');

/* ---------- ids ---------- */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- money ---------- */
export const MAX_AMOUNT = 10_000_000 * 100;

export function parseAmount(input) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * 100);
  }
  if (typeof input !== 'string') return null;
  const s = input.replace(/[,\s₪]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(s) && !/^\.\d{1,2}$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const agorot = Number(whole || '0') * 100 + Number((frac + '00').slice(0, 2));
  if (agorot > MAX_AMOUNT) return null;
  return agorot;
}

export function formatMoney(agorot, currency = '₪', { signed = false, round = false } = {}) {
  const neg = agorot < 0;
  const abs = Math.abs(Math.round(agorot));
  let shekels = Math.floor(abs / 100);
  let cents = abs % 100;
  if (round && cents) {
    shekels = Math.round(abs / 100);
    cents = 0;
  }
  const body = shekels.toLocaleString('en-US') + (cents ? '.' + pad(cents) : '');
  const sign = neg ? '−' : signed && agorot > 0 ? '+' : '';
  return `${sign}${currency}${body}`;
}

// Keypad state machine: returns the new amount string after a key press.
export function keypadInput(str, key) {
  str = str || '';
  if (key === 'back') return str.slice(0, -1);
  if (key === 'clear') return '';
  if (key === '.') {
    if (str.includes('.')) return str;
    return (str || '0') + '.';
  }
  if (!/^\d$/.test(key)) return str;
  const [whole, frac] = str.split('.');
  if (frac !== undefined) {
    if (frac.length >= 2) return str;
    return str + key;
  }
  if (whole === '0') return key; // no leading zeros
  if (whole.length >= 7) return str;
  return str + key;
}

/* ---------- dates (local, ISO yyyy-mm-dd strings) ---------- */
export function iso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function todayISO(now = new Date()) {
  return iso(now);
}
export function addDays(s, n) {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function dayDiff(a, b) {
  // whole days from a to b (b - a). Rounding absorbs DST hour shifts.
  return Math.round((fromISO(b) - fromISO(a)) / 86400000);
}
export function daysInMonth(y, m0) {
  return new Date(y, m0 + 1, 0).getDate();
}
export function monthKey(s) {
  return s.slice(0, 7);
}
export function nextMonthKey(key, n = 1) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function clampDay(key, day) {
  const [y, m] = key.split('-').map(Number);
  return `${key}-${pad(Math.min(day, daysInMonth(y, m - 1)))}`;
}

export function clampCycleDay(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return 1;
  return Math.min(28, Math.max(1, n));
}

// A budget cycle runs from cycleDay of one month (inclusive) to cycleDay of the next (exclusive).
export function cycleFor(dateISO, cycleDay = 1) {
  cycleDay = clampCycleDay(cycleDay);
  const d = fromISO(dateISO);
  let y = d.getFullYear();
  let m = d.getMonth();
  if (d.getDate() < cycleDay) {
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  const start = new Date(y, m, cycleDay);
  const end = new Date(y, m + 1, cycleDay);
  return { start: iso(start), end: iso(end), key: `${y}-${pad(m + 1)}`, cycleDay };
}
export function shiftCycle(cycle, n) {
  const s = fromISO(cycle.start);
  return cycleFor(iso(new Date(s.getFullYear(), s.getMonth() + n, cycle.cycleDay)), cycle.cycleDay);
}
export function inCycle(dateISO, cycle) {
  return dateISO >= cycle.start && dateISO < cycle.end;
}
export function cycleLabel(cycle) {
  const s = fromISO(cycle.start);
  if (cycle.cycleDay === 1) return `${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  const e = fromISO(addDays(cycle.end, -1));
  return `${s.getDate()} ב${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ב${MONTHS_SHORT[e.getMonth()]}`;
}
export function shortCycleLabel(cycle) {
  const s = fromISO(cycle.start);
  return cycle.cycleDay === 1 ? MONTHS_SHORT[s.getMonth()] : `${s.getDate()}/${s.getMonth() + 1}`;
}
export function dayLabel(dateISO, today) {
  if (today) {
    const diff = dayDiff(dateISO, today);
    if (diff === 0) return 'היום';
    if (diff === 1) return 'אתמול';
  }
  const d = fromISO(dateISO);
  return `יום ${WEEKDAYS[d.getDay()]}, ${d.getDate()} ב${MONTHS_SHORT[d.getMonth()]}`;
}

/* ---------- recurring (fixed) expenses ---------- */
// Item: { id, name, amount, catId, day, startMonth:'YYYY-MM', lastMonth:'YYYY-MM'|null, active }
export function recurringDue(recurring, today) {
  const out = [];
  const thisMonth = monthKey(today);
  for (const r of recurring || []) {
    if (!r.active) continue;
    let m = r.lastMonth ? nextMonthKey(r.lastMonth) : r.startMonth;
    if (!m) continue;
    let guard = 0;
    while (m <= thisMonth && guard++ < 36) {
      const date = clampDay(m, r.day);
      if (date > today) break;
      out.push({ item: r, date, month: m });
      m = nextMonthKey(m);
    }
  }
  return out;
}

// Applies due recurring items to state (mutates a copy). Returns { state, added }.
export function applyRecurring(state, today) {
  const due = recurringDue(state.recurring, today);
  if (!due.length) return { state, added: [] };
  const next = { ...state, expenses: [...state.expenses], recurring: state.recurring.map((r) => ({ ...r })) };
  const added = [];
  for (const { item, date, month } of due) {
    const exp = {
      id: uid(),
      amount: item.amount,
      catId: item.catId,
      note: item.name,
      date,
      createdAt: Date.now(),
      recurringId: item.id,
    };
    next.expenses.push(exp);
    added.push(exp);
    const r = next.recurring.find((x) => x.id === item.id);
    if (!r.lastMonth || month > r.lastMonth) r.lastMonth = month;
  }
  return { state: next, added };
}

// Fixed charges still to come inside the cycle (after today), per category.
export function upcomingRecurring(recurring, cycle, today) {
  const list = [];
  for (const r of recurring || []) {
    if (!r.active) continue;
    // candidate dates in the cycle: one per month touched by the cycle
    for (const key of [monthKey(cycle.start), nextMonthKey(monthKey(cycle.start))]) {
      const date = clampDay(key, r.day);
      if (!inCycle(date, cycle) || date <= today) continue;
      if (r.startMonth && key < r.startMonth) continue;
      if (r.lastMonth && key <= r.lastMonth) continue;
      list.push({ item: r, date });
    }
  }
  return list.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/* ---------- budgets ---------- */
export function expensesInCycle(expenses, cycle) {
  return expenses.filter((e) => inCycle(e.date, cycle));
}

export function sumBy(expenses, pred = () => true) {
  let t = 0;
  for (const e of expenses) if (pred(e)) t += e.amount;
  return t;
}

/**
 * Status of one budget envelope inside a cycle.
 * reserved = known fixed charges still to come this cycle (counted as already spoken for).
 */
export function budgetStatus({ budget, expenses, cycle, today, alertAt = 0.8, reserved = 0 }) {
  const totalDays = dayDiff(cycle.start, cycle.end);
  const current = inCycle(today, cycle);
  const past = today >= cycle.end;
  const daysLeft = current ? dayDiff(today, cycle.end) : past ? 0 : totalDays; // includes today
  const elapsed = current ? dayDiff(cycle.start, today) + 1 : past ? totalDays : 0;

  const spent = sumBy(expenses);
  // only day-to-day spending counts against "today"; fixed charges dated today are part of the monthly base
  const spentToday = current ? sumBy(expenses, (e) => e.date === today && !e.recurringId) : 0;
  const fixed = sumBy(expenses, (e) => !!e.recurringId);
  const variable = spent - fixed;

  const base = { budget: budget || 0, spent, spentToday, fixed, reserved, totalDays, daysLeft, elapsed, current };
  if (!budget) return { ...base, hasBudget: false, state: 'none' };

  const committed = spent + reserved;
  const left = budget - committed;
  const ratio = committed / budget;
  const state = committed > budget ? 'over' : ratio >= alertAt ? 'warn' : 'ok';
  const pace = elapsed / totalDays; // where you "should" be today
  const projected = elapsed > 0 ? Math.round(fixed + reserved + (variable / elapsed) * totalDays) : committed;
  const projectionReliable = elapsed >= 4 && variable > 0;
  const perDay = daysLeft > 0 ? Math.max(0, Math.floor((budget - (committed - spentToday)) / daysLeft)) : 0;
  const todayLeft = perDay - spentToday;
  return {
    ...base,
    hasBudget: true,
    left,
    ratio,
    state,
    pace,
    projected,
    projectionReliable,
    willOverrun: projectionReliable && projected > budget && state !== 'over',
    perDay,
    todayLeft,
  };
}

export function overallBudget(state) {
  const explicit = state.settings.monthlyBudget || 0;
  if (explicit) return explicit;
  return state.categories.filter((c) => !c.archived).reduce((t, c) => t + (c.budget || 0), 0);
}

export function cycleSummary(state, today, cycle = cycleFor(today, state.settings.cycleDay)) {
  const exps = expensesInCycle(state.expenses, cycle);
  const upcoming = upcomingRecurring(state.recurring, cycle, today);
  const alertAt = state.settings.alertAt ?? 0.8;
  const cats = state.categories
    .filter((c) => !c.archived || exps.some((e) => e.catId === c.id))
    .map((c) => {
      const ce = exps.filter((e) => e.catId === c.id);
      const reserved = upcoming.filter((u) => u.item.catId === c.id).reduce((t, u) => t + u.item.amount, 0);
      return { cat: c, status: budgetStatus({ budget: c.budget, expenses: ce, cycle, today, alertAt, reserved }), count: ce.length };
    });
  // With an explicit monthly total, everything counts. Without one, the total is the sum of the
  // envelopes, so only spending in budgeted categories is measured against it.
  const derived = !state.settings.monthlyBudget;
  const budgeted = new Set(state.categories.filter((c) => !c.archived && c.budget).map((c) => c.id));
  const inScope = (catId) => !derived || budgeted.has(catId);
  const reservedAll = upcoming.filter((u) => inScope(u.item.catId)).reduce((t, u) => t + u.item.amount, 0);
  const overall = {
    ...budgetStatus({ budget: overallBudget(state), expenses: exps.filter((e) => inScope(e.catId)), cycle, today, alertAt, reserved: reservedAll }),
    derived,
  };
  return { cycle, expenses: exps, cats, overall, upcoming };
}

/**
 * What would happen to the category budget if this expense is saved.
 * excludeId: when editing, ignore the original version of the expense.
 */
export function impactOf(state, { catId, amount, date, excludeId }, today) {
  const cat = state.categories.find((c) => c.id === catId);
  if (!cat || !cat.budget || !amount) return null;
  const cycle = cycleFor(date || today, state.settings.cycleDay);
  const exps = expensesInCycle(state.expenses, cycle).filter((e) => e.catId === catId && e.id !== excludeId);
  const upcoming = upcomingRecurring(state.recurring, cycle, today).filter((u) => u.item.catId === catId);
  const reserved = upcoming.reduce((t, u) => t + u.item.amount, 0);
  const before = sumBy(exps) + reserved;
  const after = before + amount;
  const alertAt = state.settings.alertAt ?? 0.8;
  const warnLine = Math.round(cat.budget * alertAt);
  const fake = { id: '__new', amount, catId, date: date || today };
  const st = budgetStatus({ budget: cat.budget, expenses: [...exps, fake], cycle, today, alertAt, reserved });
  return {
    cat,
    budget: cat.budget,
    before,
    after,
    leftAfter: cat.budget - after,
    overBy: Math.max(0, after - cat.budget),
    wasOver: before > cat.budget,
    willBeOver: after > cat.budget,
    crossesWarn: before < warnLine && after >= warnLine && after <= cat.budget,
    // what's left after this expense, spread over the remaining days (today included)
    perDayAfter: st.daysLeft > 0 ? Math.max(0, Math.floor((cat.budget - after) / st.daysLeft)) : 0,
    daysLeft: st.daysLeft,
    currentCycle: inCycle(today, cycle),
  };
}

/* ---------- insights ---------- */
export function cycleTotals(state, today, n = 6) {
  const cur = cycleFor(today, state.settings.cycleDay);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const c = shiftCycle(cur, -i);
    out.push({ cycle: c, total: sumBy(expensesInCycle(state.expenses, c)), current: i === 0 });
  }
  return out;
}

export function categoryCompare(state, today) {
  const cur = cycleFor(today, state.settings.cycleDay);
  const prev = shiftCycle(cur, -1);
  const a = expensesInCycle(state.expenses, cur);
  const b = expensesInCycle(state.expenses, prev);
  // compare like with like: the previous cycle up to the same day offset
  const offset = dayDiff(cur.start, today);
  const prevCut = addDays(prev.start, offset);
  return state.categories
    .map((c) => {
      const now = sumBy(a, (e) => e.catId === c.id);
      const before = sumBy(b, (e) => e.catId === c.id && e.date <= prevCut);
      const prevFull = sumBy(b, (e) => e.catId === c.id);
      return { cat: c, now, before, prevFull, delta: now - before };
    })
    .filter((r) => r.now || r.prevFull)
    .sort((x, y) => y.now - x.now);
}

export function weekdayPattern(expenses, { excludeRecurring = true } = {}) {
  const totals = Array(7).fill(0);
  const days = Array.from({ length: 7 }, () => new Set());
  let firstDate = null;
  for (const e of expenses) {
    if (excludeRecurring && e.recurringId) continue;
    const d = fromISO(e.date).getDay();
    totals[d] += e.amount;
    days[d].add(e.date);
    if (!firstDate || e.date < firstDate) firstDate = e.date;
  }
  return totals.map((t, i) => ({ day: i, total: t, activeDays: days[i].size }));
}

// Days of a cycle (up to today) marked as spend / no-spend. Fixed charges do not break a no-spend day.
export function noSpendCalendar(state, cycle, today) {
  const spentDates = new Map();
  for (const e of expensesInCycle(state.expenses, cycle)) {
    if (e.recurringId) continue;
    spentDates.set(e.date, (spentDates.get(e.date) || 0) + e.amount);
  }
  const days = [];
  for (let d = cycle.start; d < cycle.end; d = addDays(d, 1)) {
    days.push({ date: d, future: d > today, today: d === today, spent: spentDates.get(d) || 0 });
  }
  const past = days.filter((d) => !d.future && !d.today);
  const noSpend = past.filter((d) => !d.spent).length;
  // current streak of no-spend days ending yesterday (today counts if nothing spent yet? no — day not over)
  let streak = 0;
  for (let i = past.length - 1; i >= 0 && !past[i].spent; i--) streak++;
  return { days, noSpend, streak };
}

export function categoryHabit(state, catId, today, cycles = 3) {
  // average spend per entry and per week over the last N cycles, to suggest concrete savings
  const cur = cycleFor(today, state.settings.cycleDay);
  const from = shiftCycle(cur, -(cycles - 1)).start;
  const list = state.expenses.filter((e) => e.catId === catId && e.date >= from && e.date <= today && !e.recurringId);
  if (list.length < 3) return null;
  const total = sumBy(list);
  const days = Math.max(7, dayDiff(from, today) + 1);
  const avg = Math.round(total / list.length);
  const perWeek = (list.length / days) * 7;
  return { count: list.length, total, avg, perWeek, yearlyIfOneLessPerWeek: avg * 52, days };
}

export function recurringTotals(recurring) {
  const active = (recurring || []).filter((r) => r.active);
  const monthly = active.reduce((t, r) => t + r.amount, 0);
  return { monthly, yearly: monthly * 12, count: active.length };
}

/* ---------- wishlist (cooling-off) ---------- */
export function wishState(item, now = Date.now()) {
  const readyAt = item.addedAt + item.waitHours * 3600_000;
  const msLeft = readyAt - now;
  return { ready: msLeft <= 0, msLeft: Math.max(0, msLeft), readyAt };
}
export function formatWait(ms) {
  const h = Math.ceil(ms / 3600_000);
  if (h <= 1) return 'פחות משעה';
  if (h < 24) return `עוד ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? 'עוד יום' : d === 2 ? 'עוד יומיים' : `עוד ${d} ימים`;
}

/* ---------- export ---------- */
export function toCSV(state) {
  const cats = Object.fromEntries(state.categories.map((c) => [c.id, c.name]));
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [['תאריך', 'קטגוריה', 'סכום', 'פירוט', 'קבועה'].map(q).join(',')];
  const sorted = [...state.expenses].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const e of sorted) {
    rows.push([e.date, cats[e.catId] || '', (e.amount / 100).toFixed(2), e.note || '', e.recurringId ? 'כן' : ''].map(q).join(','));
  }
  return '\uFEFF' + rows.join('\r\n');
}

/* ---------- places: remembers where you spend ---------- */
// A "place" is the note text of an expense. After it appears MIN_PLACE_COUNT times it is remembered:
// typing it again picks its category automatically, and it shows up as a one-tap suggestion.
export const MIN_PLACE_COUNT = 2;

export function placeKey(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function learnPlaces(expenses, prefs = {}, minCount = MIN_PLACE_COUNT) {
  const map = new Map();
  for (const e of expenses) {
    if (e.recurringId) continue;
    const k = placeKey(e.note);
    if (k.length < 2) continue;
    let p = map.get(k);
    if (!p) {
      p = { key: k, name: '', count: 0, total: 0, cats: {}, hist: [], last: '' };
      map.set(k, p);
    }
    p.count++;
    p.total += e.amount;
    p.cats[e.catId] = (p.cats[e.catId] || 0) + 1;
    p.hist.push(e);
    if (e.date >= p.last) {
      p.last = e.date;
      p.name = String(e.note).trim().replace(/\s+/g, ' ');
    }
  }
  const out = [];
  for (const p of map.values()) {
    const pref = (prefs || {})[p.key] || {};
    if (pref.hidden || p.count < minCount) continue;
    const topCat = Object.entries(p.cats).sort((a, b) => b[1] - a[1])[0][0];
    const recent = p.hist
      .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (b.createdAt || 0) - (a.createdAt || 0)))
      .slice(0, 3)
      .map((e) => e.amount);
    const usual = recent.length >= 2 && recent.every((a) => a === recent[0]) ? recent[0] : null;
    out.push({
      key: p.key,
      name: p.name,
      count: p.count,
      total: p.total,
      avg: Math.round(p.total / p.count),
      catId: pref.catId || topCat,
      usual,
      last: p.last,
    });
  }
  return out.sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0));
}

export function matchPlaces(places, query, limit = 5) {
  const q = placeKey(query);
  if (!q) return places.slice(0, limit);
  const starts = places.filter((p) => p.key.startsWith(q));
  const contains = places.filter((p) => !p.key.startsWith(q) && p.key.includes(q));
  return [...starts, ...contains].slice(0, limit);
}

export function findPlace(places, note) {
  const k = placeKey(note);
  return k ? places.find((p) => p.key === k) || null : null;
}

/* ---------- monthly check-in (income, cash, investments) ---------- */
// The check-in "period" is the month of the most recent check-in day on or before today.
export function checkInPeriod(today, day = 10) {
  day = clampCycleDay(day);
  const d = fromISO(today);
  const key = monthKey(today);
  return d.getDate() >= day ? key : nextMonthKey(key, -1);
}

export function checkInStatus(state, today) {
  const day = clampCycleDay(state.settings.checkInDay ?? 10);
  const period = checkInPeriod(today, day);
  const snap = (state.snapshots || []).find((s) => s.period === period) || null;
  return { period, day, date: `${period}-${pad(day)}`, due: !snap, snap };
}

export function netWorth(s) {
  return s ? (s.cash || 0) + (s.investments || 0) + (s.savings || 0) : 0;
}

export function netWorthSeries(snapshots) {
  return [...(snapshots || [])]
    .sort((a, b) => (a.period < b.period ? -1 : 1))
    .map((s) => ({ period: s.period, total: netWorth(s), cash: s.cash || 0, investments: s.investments || 0, savings: s.savings || 0, income: s.income || 0 }));
}

export function monthLabelFromKey(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

// Income of a cycle = income reported in check-ins dated inside that cycle; otherwise the income setting.
export function incomeForCycle(state, cycle) {
  const snaps = (state.snapshots || []).filter((s) => inCycle(s.date, cycle) && s.income);
  if (snaps.length) return { amount: snaps.reduce((t, s) => t + s.income, 0), source: 'checkin' };
  return state.settings.income ? { amount: state.settings.income, source: 'setting' } : { amount: 0, source: 'none' };
}

/* ---------- improvement tips ---------- */
export function improvementTips(state, cycle, today, max = 4) {
  const cur = state.settings.currency || '₪';
  const fm = (a) => formatMoney(a, cur, { round: true });
  const exps = expensesInCycle(state.expenses, cycle);
  const variable = exps.filter((e) => !e.recurringId);
  const complete = today >= cycle.end;
  const tips = [];

  // 1. envelopes that went over
  for (const c of state.categories) {
    if (!c.budget) continue;
    const list = variable.filter((e) => e.catId === c.id);
    const spent = sumBy(exps, (e) => e.catId === c.id);
    if (spent <= c.budget) continue;
    const over = spent - c.budget;
    const avg = list.length ? Math.round(sumBy(list) / list.length) : 0;
    const times = avg ? Math.max(1, Math.ceil(over / avg)) : 0;
    const weekly = Math.floor(c.budget / 4.3);
    tips.push({
      kind: 'over',
      catId: c.id,
      saving: over,
      title: `${c.name}: חריגה של ${fm(over)}`,
      detail: times && times <= 4
        ? `בממוצע ${fm(avg)} לפעם. ${times === 1 ? 'פעם אחת פחות' : `${times} פעמים פחות`} בחודש, וחוזרים לתקציב.`
        : `הפער גדול מכדי לסגור בוויתור פה ושם. או שהתקציב נמוך מדי, או שכדאי תקרה שבועית של ${fm(weekly)}.`,
    });
  }

  // 2. small habits you keep going back to (coffee, snacks) — not big necessary shops
  const places = learnPlaces(variable, state.placePrefs, 4).filter((p) => p.total >= 10000 && p.avg <= 12000).slice(0, 2);
  for (const p of places) {
    const half = Math.round(p.total / 2);
    tips.push({ kind: 'place', saving: half, title: `${p.name}: ${p.count} פעמים, ${fm(p.total)}`, detail: `חצי מהפעמים = ${fm(half)} בחודש, ${fm(half * 12)} בשנה.` });
  }

  // 3. categories that jumped vs the previous cycle (same point in time)
  const prev = shiftCycle(cycle, -1);
  const offset = complete ? dayDiff(cycle.start, cycle.end) : dayDiff(cycle.start, today) + 1;
  const prevCut = addDays(prev.start, offset);
  const overCats = new Set(tips.filter((t) => t.kind === 'over').map((t) => t.catId));
  for (const c of state.categories) {
    if (overCats.has(c.id)) continue; // already covered by its over-budget tip
    const now = sumBy(variable, (e) => e.catId === c.id);
    const before = sumBy(state.expenses, (e) => !e.recurringId && e.catId === c.id && e.date >= prev.start && e.date < prevCut && e.date < prev.end);
    const delta = now - before;
    if (before > 0 && delta >= Math.max(10000, before * 0.25)) {
      tips.push({ kind: 'jump', saving: delta, title: `${c.name} עלה ב־${fm(delta)}`, detail: `לעומת ${fm(before)} באותה תקופה במחזור הקודם. מה השתנה?` });
    }
  }

  // 4. small subscriptions add up
  const subs = (state.recurring || []).filter((r) => r.active && r.amount < 50000);
  if (subs.length >= 2) {
    const monthly = subs.reduce((t, r) => t + r.amount, 0);
    const avgSub = Math.round(monthly / subs.length);
    tips.push({
      kind: 'subs',
      saving: avgSub,
      title: `${subs.length} חיובים קבועים קטנים: ${fm(monthly)} בחודש`,
      detail: `${fm(monthly * 12)} בשנה. ביטול של אחד שלא בשימוש חוסך בממוצע ${fm(avgSub * 12)} בשנה.`,
    });
  }

  // 5. one weekday eats the budget
  const varTotal = sumBy(variable);
  if (varTotal >= 50000) {
    const wd = weekdayPattern(variable);
    const top = wd.reduce((a, b) => (b.total > a.total ? b : a), wd[0]);
    const share = top.total / varTotal;
    if (share >= 0.3) {
      const save = Math.round(top.total * 0.15);
      tips.push({ kind: 'weekday', saving: save, title: `${Math.round(share * 100)}% מההוצאות היו ביום ${WEEKDAYS[top.day]}`, detail: `תקציב קבוע ליום הזה, ו־15% פחות = ${fm(save)} בחודש.` });
    }
  }

  // 6. savings rate
  const inc = incomeForCycle(state, cycle).amount;
  if (inc > 0) {
    const reserved = complete ? 0 : upcomingRecurring(state.recurring, cycle, today).reduce((t, u) => t + u.item.amount, 0);
    const left = inc - sumBy(exps) - reserved;
    const target = Math.round(inc * 0.1);
    if (left < target) {
      tips.push({
        kind: 'rate',
        saving: target - left,
        title: left < 0 ? `ההוצאות עברו את ההכנסה ב־${fm(-left)}` : `נשאר רק ${Math.round((left / inc) * 100)}% מההכנסה`,
        detail: `יעד ראשון: לשים בצד 10% מההכנסה — ${fm(target)} בחודש.`,
      });
    }
  }

  // 7. too few no-spend days (only for a finished cycle)
  if (complete && variable.length) {
    const cal = noSpendCalendar(state, cycle, addDays(cycle.end, 1));
    const spendDays = cal.days.filter((d) => d.spent).length;
    if (cal.noSpend < 4 && spendDays) {
      const save = Math.round((varTotal / spendDays) * 4);
      tips.push({ kind: 'nospend', saving: save, title: `רק ${cal.noSpend} ימים בלי הוצאות`, detail: `יום אחד בשבוע בלי הוצאות ≈ ${fm(save)} בחודש.` });
    }
  }

  return tips.sort((a, b) => b.saving - a.saving).slice(0, max);
}

/* ---------- monthly report ---------- */
export function monthlyReport(state, cycle, today) {
  const cur = state.settings.currency || '₪';
  const fm = (a) => formatMoney(a, cur, { round: true });
  const exps = expensesInCycle(state.expenses, cycle);
  const spent = sumBy(exps);
  const fixed = sumBy(exps, (e) => !!e.recurringId);
  const income = incomeForCycle(state, cycle);
  const left = income.amount - spent;
  const prevSpent = sumBy(expensesInCycle(state.expenses, shiftCycle(cycle, -1)));
  const byCat = state.categories
    .map((c) => {
      const s = sumBy(exps, (e) => e.catId === c.id);
      return { cat: c, spent: s, budget: c.budget || 0, over: c.budget ? Math.max(0, s - c.budget) : 0 };
    })
    .filter((r) => r.spent || r.budget)
    .sort((a, b) => b.spent - a.spent);
  const budgeted = byCat.filter((r) => r.budget);
  const resisted = (state.resisted || []).filter((r) => inCycle(r.date, cycle));
  const cal = noSpendCalendar(state, cycle, today >= cycle.end ? addDays(cycle.end, 1) : today);

  const snapIn = (c) => (state.snapshots || []).filter((s) => inCycle(s.date, c)).sort((a, b) => (a.date < b.date ? -1 : 1))[0] || null;
  const startSnap = snapIn(cycle);
  const endSnap = snapIn(shiftCycle(cycle, 1));
  const netChange = startSnap && endSnap ? netWorth(endSnap) - netWorth(startSnap) : null;

  const wins = [];
  const okEnv = budgeted.filter((r) => !r.over).length;
  if (budgeted.length && okEnv >= budgeted.length / 2) wins.push(`${okEnv} מתוך ${budgeted.length} מעטפות נשארו בתקציב`);
  if (prevSpent && spent < prevSpent) wins.push(`הוצאת ${fm(prevSpent - spent)} פחות מהמחזור הקודם`);
  if (resisted.length) wins.push(`ויתרת על ${resisted.length} דברים — ${fm(sumBy(resisted))} נשארו אצלך`);
  if (cal.noSpend >= 4) wins.push(`${cal.noSpend} ימים בלי הוצאות`);
  if (netChange > 0) wins.push(`השווי שלך עלה ב־${fm(netChange)}`);

  return {
    cycle,
    complete: today >= cycle.end,
    income: income.amount,
    incomeSource: income.source,
    spent,
    fixed,
    variable: spent - fixed,
    left,
    rate: income.amount ? left / income.amount : null,
    prevSpent,
    delta: spent - prevSpent,
    byCat,
    resisted: sumBy(resisted),
    noSpend: cal.noSpend,
    startSnap,
    endSnap,
    netChange,
    tips: improvementTips(state, cycle, today),
    wins,
    count: exps.length,
  };
}

// The most recent finished cycle that has data, if its report hasn't been opened yet.
export function pendingReport(state, today) {
  const last = shiftCycle(cycleFor(today, state.settings.cycleDay), -1);
  if (!expensesInCycle(state.expenses, last).length) return null;
  if (state.settings.lastReportSeen === last.start) return null;
  return last;
}

/* ---------- annual expenses spread evenly (insurance etc.) ---------- */
// Item: { id, name, total, catId, start:'YYYY-MM-DD', months, createdAt }
// One payment (or a yearly policy) is budgeted as `months` equal monthly shares, so a
// ₪3,600 car insurance counts as ₪300 in every month instead of wrecking one month.
export const SPREAD_PREFIX = 'spread:';

export function spreadShares(total, months) {
  months = Math.max(1, Math.round(months));
  const base = Math.floor(total / months);
  const extra = total - base * months; // leftover agorot go to the first shares
  return Array.from({ length: months }, (_, i) => base + (i < extra ? 1 : 0));
}

export function spreadEntries(item) {
  const day = Math.min(28, Number(item.start.slice(8, 10)));
  const firstMonth = monthKey(item.start);
  return spreadShares(item.total, item.months).map((amount, i) => ({
    id: `sp-${item.id}-${i}`,
    amount,
    catId: item.catId,
    note: `${item.name} (${i + 1}/${item.months})`,
    date: i === 0 && Number(item.start.slice(8, 10)) <= 28 ? item.start : clampDay(nextMonthKey(firstMonth, i), day),
    createdAt: item.createdAt || 0,
    recurringId: SPREAD_PREFIX + item.id, // behaves like a fixed charge everywhere
    spreadId: item.id,
  }));
}

// Rebuilds all spread shares from the items, so edits/deletes stay consistent.
export function syncSpreads(state) {
  const items = state.spreads || [];
  const kept = state.expenses.filter((e) => !e.spreadId);
  const generated = items.flatMap(spreadEntries);
  return { ...state, expenses: [...kept, ...generated] };
}

export function spreadInfo(item, today) {
  const end = clampDay(nextMonthKey(monthKey(item.start), item.months), Math.min(28, Number(item.start.slice(8, 10))));
  const shares = spreadEntries(item);
  const passed = shares.filter((e) => e.date <= today).length;
  const daysToEnd = dayDiff(today, end);
  return {
    monthly: Math.round(item.total / item.months),
    end,
    passed,
    active: today < end,
    renewSoon: daysToEnd >= 0 && daysToEnd <= 30,
    daysToEnd,
  };
}

export function spreadTotals(spreads, today) {
  const active = (spreads || []).filter((s) => spreadInfo(s, today).active && s.start <= today);
  const monthly = active.reduce((t, s) => t + Math.round(s.total / s.months), 0);
  return { count: active.length, monthly, yearly: active.reduce((t, s) => t + Math.round((s.total / s.months) * 12), 0) };
}

/* ---------- calendar reminder (.ics) — a real iPhone alert on the check-in day ---------- */
function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
export function reminderICS({ checkInDay, cycleDay, url = '', now = new Date() }) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const first = (day) => {
    const d = new Date(now.getFullYear(), now.getMonth(), day);
    if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  };
  const ev = (uid, day, summary, desc) => [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${first(day)}T090000`,
    `DTEND:${first(day)}T091500`,
    `RRULE:FREQ=MONTHLY;BYMONTHDAY=${day}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(desc + (url ? `\n${url}` : ''))}`,
    ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    `DESCRIPTION:${icsEscape(summary)}`,
    'END:VALARM',
    'END:VEVENT',
  ];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pinkas//Budget//HE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  lines.push(...ev('pinkas-checkin@pinkas.app', checkInDay, 'פנקס: צ׳ק־אין חודשי', 'כמה נכנס החודש, כמה יש בעו״ש ובהשקעות. דקה אחת.'));
  if (cycleDay !== checkInDay) lines.push(...ev('pinkas-report@pinkas.app', cycleDay, 'פנקס: הסיכום החודשי מוכן', 'הוצאות מול הכנסות, ואיפה אפשר להשתפר.'));
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
