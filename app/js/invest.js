// Investments: Israeli broker fee data, a fee calculator, and general (non-personal) guidance.
// Pure functions only — no DOM — so everything here is testable.
//
// IMPORTANT: this is a cost calculator and general education, not investment advice.
// Fees change often. Values below were cross-checked on public comparison pages in November 2026
// (israel-investing.com/comparison, gemeltop.co.il, financecheck.co.il) and Blink's own price list.
// Where sources disagreed, the range is kept and the calculation uses the more expensive value.

import { futureValue, formatMoney } from './logic.js';

export const FEES_CHECKED = 'נובמבר 2026';
export const USD_ILS = 3.65; // approximate, for converting $ minimums; shown in the UI as an assumption

export const FEE_SOURCES = [
  { label: 'israel-investing.com', url: 'https://israel-investing.com/comparison' },
  { label: 'gemeltop.co.il', url: 'https://gemeltop.co.il/hashvaat-batei-hashkaot-mschar-atzmai/' },
  { label: 'התעריפון של בלינק', url: 'https://heyblink.com/pricing/' },
];

/*
  monthly:    handling fee ₪/month. offset: commissions count against it. exempt: 0.
  ta:         Tel Aviv { rate, min ₪ } or null when not offered to private clients
  us:         US stocks { min $ per trade, freeTrades per month }
  custodyPct: yearly % of portfolio (banks)
*/
export const BROKERS = [
  {
    id: 'blink', name: 'בלינק', kind: 'app',
    monthly: 0, offset: false,
    ta: null,
    us: { min: 1.5, freeTrades: 10 },
    fx: 'בלי עמלת המרה מוצהרת, מרוויחים מהמרווח בשער',
    minDeposit: 0,
    note: 'רק מניות וקרנות סל בארה״ב. עד 10 פעולות בחודש בלי עמלה.',
  },
  {
    id: 'interactive', name: 'אינטראקטיב ישראל', kind: 'broker',
    monthly: 0, offset: false,
    ta: null,
    us: { min: 2.5, minRange: '$1–2.5' },
    fx: '₪10 קבוע להמרה',
    minDeposit: 0,
    note: 'זול לחו״ל. מסחר בת״א לא זמין ללקוחות פרטיים (לפי חלק מהמקורות).',
  },
  {
    id: 'psagot', name: 'פסגות טרייד', kind: 'broker',
    monthly: 0, offset: false,
    ta: { rate: 0.0006, min: 2 },
    us: { min: 6 },
    fx: 'פטור מעמלת המרה (לפי israel-investing)',
    minDeposit: 10000,
    note: 'פטור מדמי טיפול.',
  },
  {
    id: 'altshuler', name: 'אלטשולר שחם טרייד', kind: 'broker',
    monthly: 0, offset: false,
    ta: { rate: 0.0007, min: 2.9 },
    us: { min: 6 },
    fx: 'בלי עמלת המרה, המרווח לא מפורסם',
    minDeposit: 5000,
    note: 'פטור מדמי טיפול בלי הגבלת זמן. חלקי מניות.',
  },
  {
    id: 'excellence', name: 'אקסלנס טרייד', kind: 'broker',
    monthly: 15, offset: true,
    ta: { rate: 0.0007, min: 3 },
    us: { min: 6, minRange: '$5–6' },
    fx: '2 אגורות לדולר (לפי gemeltop)',
    minDeposit: 15000, minDepositRange: '₪10,000–15,000',
    promo: 'פטור מדמי טיפול ל־2–3 שנים למצטרפים',
    note: 'דמי הטיפול מתקזזים מול עמלות.',
  },
  {
    id: 'meitav', name: 'מיטב טרייד', kind: 'broker',
    monthly: 15, offset: false,
    ta: { rate: 0.0008, min: 4.65, rateRange: '0.07%–0.08%' },
    us: { min: 7.5, minRange: '$5–7.5 לפי הפלטפורמה' },
    fx: 'בלי עמלה, מרווח בלבד',
    minDeposit: 5000,
    promo: 'פטור מדמי טיפול לשנתיים למצטרפים',
    note: '',
  },
  {
    id: 'ibi', name: 'IBI טרייד', kind: 'broker',
    monthly: 15, offset: true,
    ta: { rate: 0.0008, min: 2.35 },
    us: { min: 7.5 },
    fx: 'מרווח בלבד (לדוגמה כ־0.7%)',
    minDeposit: 15000,
    promo: 'פטור מדמי טיפול לשנתיים למצטרפים',
    note: 'דמי הטיפול מתקזזים מול עמלות. חלקי מניות.',
  },
  {
    id: 'bank', name: 'בנק (לשם השוואה)', kind: 'bank',
    monthly: 0, offset: false, custodyPct: 0.006,
    ta: { rate: 0.0065, min: 27 },
    us: null,
    fx: 'משתנה',
    minDeposit: 0,
    note: 'דמי משמרת כ־0.4%–0.6% בשנה מהתיק, עמלת קנייה גבוהה. אפשר להתמקח.',
  },
];

/**
 * Estimated yearly cost (agorot) of investing with a broker, for a simple profile:
 * one buy per monthly deposit (+ one buy for the lump sum), held for the year. No promos.
 * profile: { market: 'ta' | 'us', monthly: agorot, lump: agorot }
 */
export function yearlyCost(broker, { market, monthly = 0, lump = 0 }) {
  const venue = market === 'us' ? broker.us : broker.ta;
  if (!venue) return { available: false };
  const trades = []; // per month: amounts bought (agorot)
  for (let m = 0; m < 12; m++) {
    const t = [];
    if (m === 0 && lump > 0) t.push(lump);
    if (monthly > 0) t.push(monthly);
    trades.push(t);
  }
  let commissions = 0;
  let handling = 0;
  for (const month of trades) {
    let c = 0;
    month.forEach((amount, i) => {
      if (market === 'us') {
        if (venue.freeTrades && i < venue.freeTrades) return;
        c += Math.round(venue.min * USD_ILS * 100); // small monthly buys hit the minimum
      } else {
        c += Math.max(Math.round(venue.min * 100), Math.round(amount * venue.rate));
      }
    });
    commissions += c;
    const fee = broker.monthly * 100;
    handling += broker.offset ? Math.max(0, fee - c) : fee;
  }
  const avgBalance = lump + monthly * 6;
  const custody = broker.custodyPct ? Math.round(avgBalance * broker.custodyPct) : 0;
  const total = commissions + handling + custody;
  const invested = lump + monthly * 12;
  return { available: true, total, commissions, handling, custody, pct: invested ? total / invested : 0 };
}

export function compareBrokers(profile, { includeBank = true } = {}) {
  return BROKERS.filter((b) => includeBank || b.kind !== 'bank')
    .map((b) => ({ broker: b, cost: yearlyCost(b, profile), belowMin: b.minDeposit && profile.lump < b.minDeposit * 100 }))
    .sort((a, b) => {
      if (a.cost.available !== b.cost.available) return a.cost.available ? -1 : 1;
      return (a.cost.total ?? 0) - (b.cost.total ?? 0);
    });
}

/* ---------- pension fees (Israel) ---------- */
// Legal caps: up to 6% of deposits and 0.5% a year of savings. Many people get far better rates.
export const PENSION_CAPS = { deposit: 0.06, savings: 0.005 };
export const PENSION_GOOD = { deposit: 0.01, savings: 0.0022 };

// Total fees paid over `years` (agorot), balance growing at `rate` with monthly deposits.
export function pensionFees({ balance, monthly, depositFee, savingsFee, years = 20, rate = 0.05 }) {
  let bal = balance;
  let paid = 0;
  for (let m = 0; m < years * 12; m++) {
    const dFee = monthly * depositFee;
    const sFee = (bal * savingsFee) / 12;
    paid += dFee + sFee;
    bal = bal * (1 + rate / 12) + monthly - dFee - sFee;
  }
  return { paid: Math.round(paid), endBalance: Math.round(bal) };
}

/* ---------- general guidance from the questionnaire ---------- */
export const HORIZONS = [
  { key: 'short', label: 'עד שנה' },
  { key: 'mid', label: '1–3 שנים' },
  { key: 'long', label: '3–7 שנים' },
  { key: 'xlong', label: 'יותר מ־7 שנים' },
];
export const GOALS = [
  { key: 'emergency', label: 'כרית ביטחון' },
  { key: 'home', label: 'דירה' },
  { key: 'retire', label: 'פרישה ועתיד' },
  { key: 'goal', label: 'מטרה מסוימת (רכב, לימודים)' },
  { key: 'grow', label: 'שהכסף יעבוד' },
];

/**
 * Builds the "smart" result screen data. Everything here is general information keyed to the answers —
 * never a recommendation to buy a specific product.
 * profile: { horizon, goal, lump, monthly, market }
 * ctx: { avgSpend, liquid } from the user's own data (agorot)
 */
export function investPlan(profile, ctx, currency = '₪') {
  const fm = (a) => formatMoney(a, currency, { round: true });
  const notes = [];
  const emergencyTarget = ctx.avgSpend * 3;
  const emergencyOk = !ctx.avgSpend || ctx.liquid >= emergencyTarget;
  if (!emergencyOk) {
    notes.push({
      kind: 'first',
      title: 'קודם כל: כרית ביטחון',
      text: `ההוצאות שלך כ־${fm(ctx.avgSpend)} בחודש. מקובל להחזיק 3–6 חודשי הוצאות בכסף נזיל (${fm(emergencyTarget)}–${fm(ctx.avgSpend * 6)}) לפני שמשקיעים בשוק. כרגע נזיל: ${fm(ctx.liquid)}.`,
    });
  }
  const short = profile.horizon === 'short' || profile.goal === 'emergency';
  if (short) {
    notes.push({
      kind: 'horizon',
      title: 'טווח קצר = תנודתיות מסוכנת',
      text: 'בשנה אחת שוק המניות יכול לרדת עשרות אחוזים. לכסף שצריך בקרוב משתמשים בדרך כלל באפיקים סולידיים: פיקדון בנקאי או קרן כספית.',
    });
  } else if (profile.horizon === 'mid') {
    notes.push({
      kind: 'horizon',
      title: 'טווח בינוני',
      text: 'ב־1–3 שנים עדיין יכולה להיות ירידה בזמן הלא נכון. כדאי לשקול כמה מהכסף באמת יכול להיות חשוף למניות, והשאר באפיק סולידי.',
    });
  } else {
    notes.push({
      kind: 'horizon',
      title: 'טווח ארוך: הזמן עובד בשבילך',
      text: 'לאורך שנים רבות, פיזור רחב (למשל קרן מחקה מדד) והפקדה חודשית קבועה הם גישה נפוצה — לא צריך לנחש מתי לקנות. ככל שהעמלות נמוכות יותר, נשאר יותר לך.',
    });
  }
  if (!short) {
    notes.push({
      kind: 'tax',
      title: 'לפני תיק עצמאי — מסלולים עם הטבות מס',
      text: 'קרן השתלמות: אחרי 6 שנים (עד התקרה) הרווחים פטורים ממס. קופת גמל להשקעה: נזילה בכל זמן, ובמשיכה כקצבה מגיל 60 — פטורה ממס. בתיק עצמאי משלמים 25% מס על הרווח הריאלי.',
    });
  }
  if (profile.goal === 'retire') {
    notes.push({ kind: 'pension', title: 'פרישה מתחילה בפנסיה', text: 'דמי ניהול בפנסיה משפיעים על עשרות אלפי שקלים לאורך השנים. בדיקת דמי הניהול שלך נמצאת למטה בעמוד.' });
  }
  const years = { short: 1, mid: 3, long: 5, xlong: 10 }[profile.horizon] || 5;
  const proj = [0.03, 0.06, 0.08].map((r) => ({ rate: r, value: futureValue({ monthly: profile.monthly, lump: profile.lump, years, annualRate: r }) }));
  return { notes, emergency: { target: emergencyTarget, ok: emergencyOk }, years, deposited: profile.lump + profile.monthly * years * 12, projection: proj, selfDirected: !short };
}
