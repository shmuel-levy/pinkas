// Persistence: one versioned JSON blob in localStorage.
// Installed home-screen apps on iOS keep their storage; we also ask for persistent storage.
import { uid, clampCycleDay, ASSET_TYPES, BANKS, PAY_METHODS } from './logic.js';

const PAY_KEYS = PAY_METHODS.map((p) => p.key);

export const STORAGE_KEY = 'pinkas.v1';
export const SCHEMA = 1;

// Muted, earthy marker colours — distinguishable, never neon.
export const PALETTE = ['#B5532C', '#5B7A4E', '#3F6E8C', '#A8862F', '#7A5C8E', '#8C4A4A', '#4E7F7A', '#6B6B5A', '#9A6B3F', '#5A6B8C'];

export function defaultCategories() {
  const names = [
    ['אוכל בחוץ', 60000],
    ['סופר', 0],
    ['תחבורה ודלק', 0],
    ['בילויים', 0],
    ['קניות', 0],
    ['חשבונות', 0],
    ['מנויים', 0],
    ['ביטוחים', 0],
    ['בריאות', 0],
    ['אחר', 0],
  ];
  return names.map(([name, budget], i) => ({ id: uid() + i, name, budget, color: PALETTE[i % PALETTE.length], archived: false }));
}

export function defaultState() {
  return {
    schema: SCHEMA,
    onboarded: false,
    settings: {
      currency: '₪',
      cycleDay: 1,
      income: 0,
      monthlyBudget: 0,
      alertAt: 0.8,
      confirmOver: true,
      waitHours: 48,
      theme: 'auto',
      installHintDismissed: false,
      focusCatId: null,
      lastBackupAt: 0,
      checkInDay: 10,
      checkInPrompted: '',
      lastReportSeen: '',
      lastStorySeen: '',
      piggyGoalId: null,
      lastSeenVersion: '',
      tourDone: false,
      installGuideSeen: false,
      bank: '',
      usdRate: null, // { rate, date }
      toursSeen: {}, // page -> true once its guide was shown
      streakShown: '', // date the daily streak animation last played
      lastPay: 'credit',
    },
    invest: { status: null, profile: null, broker: null, pension: null },
    balanceAnchor: null, // { checking, cash, at } — last balances the user stated
    visits: [], // dates the app was opened (streak)
    categories: defaultCategories(),
    expenses: [],
    recurring: [],
    goals: [],
    wishlist: [],
    resisted: [],
    snapshots: [],
    placePrefs: {},
    spreads: [],
    incomes: [],
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v) && v >= 0;
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const str = (v, max = 120) => (typeof v === 'string' ? v.slice(0, max) : '');

// Normalises any (possibly older or hand-edited) object into a valid state. Throws on garbage.
export function normalize(raw) {
  if (!isObj(raw)) throw new Error('הקובץ לא נראה כמו גיבוי של פנקס.');
  if (!Array.isArray(raw.categories) || !Array.isArray(raw.expenses)) {
    throw new Error('בקובץ חסרות קטגוריות או הוצאות, ולכן אי אפשר לשחזר ממנו.');
  }
  const base = defaultState();
  const s = isObj(raw.settings) ? raw.settings : {};
  const settings = {
    ...base.settings,
    currency: str(s.currency, 4) || '₪',
    cycleDay: clampCycleDay(s.cycleDay ?? 1),
    income: isInt(s.income) ? s.income : 0,
    monthlyBudget: isInt(s.monthlyBudget) ? s.monthlyBudget : 0,
    alertAt: typeof s.alertAt === 'number' && s.alertAt >= 0.5 && s.alertAt <= 1 ? s.alertAt : 0.8,
    confirmOver: s.confirmOver !== false,
    waitHours: isInt(s.waitHours) && s.waitHours > 0 ? s.waitHours : 48,
    theme: ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto',
    installHintDismissed: !!s.installHintDismissed,
  };
  const categories = raw.categories
    .filter((c) => isObj(c) && c.id && str(c.name))
    .map((c, i) => ({
      id: String(c.id),
      name: str(c.name, 30),
      budget: isInt(c.budget) ? c.budget : 0,
      color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : PALETTE[i % PALETTE.length],
      archived: !!c.archived,
    }));
  if (!categories.length) throw new Error('בקובץ אין אף קטגוריה תקינה.');
  const catIds = new Set(categories.map((c) => c.id));
  settings.focusCatId = catIds.has(String(s.focusCatId)) ? String(s.focusCatId) : null;
  settings.lastBackupAt = Number.isFinite(s.lastBackupAt) ? s.lastBackupAt : 0;
  settings.checkInDay = clampCycleDay(s.checkInDay ?? 10);
  settings.checkInPrompted = /^\d{4}-\d{2}$/.test(s.checkInPrompted) ? s.checkInPrompted : '';
  settings.lastReportSeen = isDate(s.lastReportSeen) ? s.lastReportSeen : '';
  settings.lastStorySeen = isDate(s.lastStorySeen) ? s.lastStorySeen : '';
  settings.lastSeenVersion = str(s.lastSeenVersion, 12);
  settings.tourDone = !!s.tourDone;
  settings.installGuideSeen = !!s.installGuideSeen;
  settings.bank = BANKS.some((b) => b.id === s.bank) ? s.bank : '';
  settings.toursSeen = {};
  if (isObj(s.toursSeen)) for (const [k, v] of Object.entries(s.toursSeen)) if (v === true && /^[a-z]{1,20}$/.test(k)) settings.toursSeen[k] = true;
  settings.streakShown = isDate(s.streakShown) ? s.streakShown : '';
  settings.lastPay = PAY_KEYS.includes(s.lastPay) ? s.lastPay : 'credit';
  settings.usdRate = isObj(s.usdRate) && Number.isFinite(s.usdRate.rate) && s.usdRate.rate > 1 && s.usdRate.rate < 10 && isDate(s.usdRate.date)
    ? { rate: s.usdRate.rate, date: s.usdRate.date }
    : null;

  const snapshots = (Array.isArray(raw.snapshots) ? raw.snapshots : [])
    .filter((x) => isObj(x) && /^\d{4}-\d{2}$/.test(x.period) && isDate(x.date))
    .map((x) => {
      // older backups: cash / investments / savings -> עו״ש / תיק השקעות / פיקדונות
      const src = isObj(x.assets) ? x.assets : { checking: x.cash, stocks: x.investments, deposits: x.savings };
      const assets = {};
      for (const t of ASSET_TYPES) assets[t.key] = isInt(src[t.key]) ? src[t.key] : 0;
      // amounts typed in dollars (cents), kept so editing shows them in $ again
      const usd = {};
      if (isObj(x.usd)) for (const t of ASSET_TYPES) if (t.fx && isInt(x.usd[t.key]) && x.usd[t.key] > 0) usd[t.key] = x.usd[t.key];
      return {
        id: String(x.id || uid()),
        period: x.period,
        date: x.date,
        income: isInt(x.income) ? x.income : 0,
        assets,
        ...(Object.keys(usd).length ? { usd, usdRate: Number.isFinite(x.usdRate) ? x.usdRate : null } : {}),
        savedAt: Number.isFinite(x.savedAt) ? x.savedAt : Date.now(),
      };
    });
  const placePrefs = {};
  if (isObj(raw.placePrefs)) {
    for (const [k, v] of Object.entries(raw.placePrefs)) {
      if (!isObj(v) || !k.trim()) continue;
      placePrefs[k.slice(0, 80)] = { catId: catIds.has(String(v.catId)) ? String(v.catId) : null, hidden: !!v.hidden };
    }
  }
  const fallbackCat = categories[categories.length - 1].id;
  const expenses = raw.expenses
    .filter((e) => isObj(e) && isInt(e.amount) && e.amount > 0 && isDate(e.date))
    .map((e) => ({
      id: String(e.id || uid()),
      amount: e.amount,
      catId: catIds.has(String(e.catId)) ? String(e.catId) : fallbackCat,
      note: str(e.note, 80),
      date: e.date,
      createdAt: Number.isFinite(e.createdAt) ? e.createdAt : Date.now(),
      ...(e.recurringId ? { recurringId: String(e.recurringId) } : {}),
      ...(e.spreadId ? { spreadId: String(e.spreadId) } : {}),
      ...(PAY_KEYS.includes(e.pay) ? { pay: e.pay } : {}),
    }));
  const recurring = (Array.isArray(raw.recurring) ? raw.recurring : [])
    .filter((r) => isObj(r) && isInt(r.amount) && r.amount > 0)
    .map((r) => ({
      id: String(r.id || uid()),
      name: str(r.name, 40) || 'הוצאה קבועה',
      amount: r.amount,
      catId: catIds.has(String(r.catId)) ? String(r.catId) : fallbackCat,
      day: Math.min(31, Math.max(1, Math.round(Number(r.day) || 1))),
      startMonth: /^\d{4}-\d{2}$/.test(r.startMonth) ? r.startMonth : null,
      lastMonth: /^\d{4}-\d{2}$/.test(r.lastMonth) ? r.lastMonth : null,
      active: r.active !== false,
      ...(PAY_KEYS.includes(r.pay) ? { pay: r.pay } : {}),
    }));
  const goals = (Array.isArray(raw.goals) ? raw.goals : [])
    .filter((g) => isObj(g) && isInt(g.target) && g.target > 0)
    .map((g) => ({
      id: String(g.id || uid()),
      name: str(g.name, 40) || 'מטרה',
      target: g.target,
      saved: isInt(g.saved) ? g.saved : 0,
      createdAt: Number(g.createdAt) || Date.now(),
      celebratedAt: Number.isFinite(g.celebratedAt) ? g.celebratedAt : 0,
    }));
  settings.piggyGoalId = goals.some((g) => g.id === String(s.piggyGoalId)) ? String(s.piggyGoalId) : null;

  // investments section: answers to the questionnaire
  const ri = isObj(raw.invest) ? raw.invest : {};
  const rp = isObj(ri.profile) ? ri.profile : null;
  const invest = {
    status: ['investing', 'invested', 'want'].includes(ri.status) ? ri.status : null,
    profile: rp
      ? {
          horizon: ['short', 'mid', 'long', 'xlong'].includes(rp.horizon) ? rp.horizon : 'long',
          goal: ['emergency', 'home', 'retire', 'goal', 'grow'].includes(rp.goal) ? rp.goal : 'grow',
          lump: isInt(rp.lump) ? rp.lump : 0,
          monthly: isInt(rp.monthly) ? rp.monthly : 0,
          market: rp.market === 'us' ? 'us' : 'ta',
        }
      : null,
    broker: typeof ri.broker === 'string' ? ri.broker.slice(0, 20) : null,
    pension: isObj(ri.pension)
      ? {
          monthly: isInt(ri.pension.monthly) ? ri.pension.monthly : 0,
          depositFee: Number.isFinite(ri.pension.depositFee) ? Math.min(0.06, Math.max(0, ri.pension.depositFee)) : 0,
          savingsFee: Number.isFinite(ri.pension.savingsFee) ? Math.min(0.005, Math.max(0, ri.pension.savingsFee)) : 0,
        }
      : null,
  };
  const wishlist = (Array.isArray(raw.wishlist) ? raw.wishlist : [])
    .filter((w) => isObj(w) && isInt(w.amount))
    .map((w) => ({
      id: String(w.id || uid()),
      name: str(w.name, 60) || 'פריט',
      amount: w.amount,
      catId: catIds.has(String(w.catId)) ? String(w.catId) : null,
      addedAt: Number(w.addedAt) || Date.now(),
      waitHours: isInt(w.waitHours) && w.waitHours > 0 ? w.waitHours : 48,
      status: ['waiting', 'bought', 'skipped'].includes(w.status) ? w.status : 'waiting',
    }));
  const resisted = (Array.isArray(raw.resisted) ? raw.resisted : [])
    .filter((r) => isObj(r) && isInt(r.amount) && r.amount > 0 && isDate(r.date))
    .map((r) => ({ id: String(r.id || uid()), name: str(r.name, 60), amount: r.amount, date: r.date, goalId: r.goalId ? String(r.goalId) : null, catId: r.catId ? String(r.catId) : null }));

  const spreads = (Array.isArray(raw.spreads) ? raw.spreads : [])
    .filter((x) => isObj(x) && isInt(x.total) && x.total > 0 && isDate(x.start))
    .map((x) => ({
      id: String(x.id || uid()),
      name: str(x.name, 40) || 'הוצאה שנתית',
      total: x.total,
      catId: catIds.has(String(x.catId)) ? String(x.catId) : fallbackCat,
      start: x.start,
      months: Math.min(36, Math.max(1, Math.round(Number(x.months) || 12))),
      createdAt: Number.isFinite(x.createdAt) ? x.createdAt : Date.now(),
    }));

  const incomes = (Array.isArray(raw.incomes) ? raw.incomes : [])
    .filter((x) => isObj(x) && isInt(x.amount) && x.amount > 0 && isDate(x.date))
    .map((x) => ({
      id: String(x.id || uid()),
      amount: x.amount,
      date: x.date,
      source: str(x.source, 30) || 'אחר',
      ...(x.to === 'cash' ? { to: 'cash' } : {}),
      note: str(x.note, 80),
      createdAt: Number.isFinite(x.createdAt) ? x.createdAt : Date.now(),
    }));

  const ba = raw.balanceAnchor;
  const balanceAnchor = isObj(ba) && Number.isInteger(ba.checking) && Number.isFinite(ba.at)
    ? { checking: ba.checking, cash: Number.isInteger(ba.cash) ? ba.cash : 0, at: ba.at }
    : null;
  const visits = (Array.isArray(raw.visits) ? raw.visits : []).filter(isDate).sort().slice(-500);

  return { schema: SCHEMA, onboarded: raw.onboarded !== false, settings, categories, expenses, recurring, goals, wishlist, resisted, snapshots, placePrefs, spreads, incomes, invest, balanceAnchor, visits: [...new Set(visits)] };
}

export function load(storage = globalThis.localStorage) {
  try {
    const txt = storage.getItem(STORAGE_KEY);
    if (!txt) return defaultState();
    return normalize(JSON.parse(txt));
  } catch (err) {
    console.warn('pinkas: could not read saved data, starting fresh', err);
    // keep the broken copy so nothing is silently lost
    try {
      const txt = storage.getItem(STORAGE_KEY);
      if (txt) storage.setItem(STORAGE_KEY + '.broken.' + Date.now(), txt);
    } catch {}
    return defaultState();
  }
}

export function save(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('pinkas: save failed', err);
    return false;
  }
}

export function exportJSON(state) {
  return JSON.stringify({ app: 'pinkas', exportedAt: new Date().toISOString(), ...state }, null, 1);
}

export function importJSON(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('הקובץ פגום או שאינו קובץ JSON. נסו לייצא גיבוי חדש.');
  }
  return normalize(raw);
}
