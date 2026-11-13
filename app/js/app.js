import * as L from './logic.js';
import * as S from './store.js';

const VERSION = '1.3.0';

/* ---------- state ---------- */
let state = S.load();
const ui = {
  tab: 'home',
  settings: false,
  report: null, // start date of the cycle whose report is open
  ledgerOffset: 0,
  ledgerView: 'list', // 'list' | 'cal'
  ledgerDay: null, // a day picked in the calendar
  ledgerQuery: '',
  ledgerCat: '',
  lastRenderedTab: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => L.todayISO();
const cur = () => state.settings.currency;
const money = (a, opts) => L.formatMoney(a, cur(), opts);
const m = (a, opts) => `<span class="num">${esc(money(a, opts))}</span>`;
const catById = (id) => state.categories.find((c) => c.id === id);
const activeCats = () => state.categories.filter((c) => !c.archived);

function persist() {
  if (!S.save(state)) toast('השמירה במכשיר נכשלה. כדאי לייצא גיבוי מההגדרות.', { alert: true });
}
function commit() {
  persist();
  render();
}

function focusCat() {
  const id = state.settings.focusCatId;
  const c = id && catById(id);
  if (c && !c.archived) return c;
  return activeCats().find((c) => c.name === 'אוכל בחוץ') || activeCats().find((c) => c.budget) || null;
}

/* ---------- small render helpers ---------- */
function bar(st, { pace = true } = {}) {
  if (!st.hasBudget) return '';
  const pct = Math.min(100, (st.ratio || 0) * 100);
  const cls = st.state === 'over' ? 'is-over' : st.state === 'warn' ? 'is-warn' : '';
  const paceMark = pace && st.current ? `<span class="bar-pace" style="inset-inline-start:${(st.pace * 100).toFixed(1)}%" title="איפה כדאי להיות היום"></span>` : '';
  return `<div class="bar ${cls}" role="img" aria-label="נוצלו ${Math.round((st.ratio || 0) * 100)} אחוז מהתקציב${st.current ? `, עברו ${Math.round(st.pace * 100)} אחוז מהחודש` : ''}"><span class="bar-fill" style="width:${pct.toFixed(1)}%"></span>${paceMark}</div>`;
}

function endLabel(cycle) {
  const d = L.fromISO(L.addDays(cycle.end, -1));
  return `${d.getDate()} ב${L.MONTHS_SHORT[d.getMonth()]}`;
}

function daysWord(n) {
  return n === 1 ? 'יום אחד' : n === 2 ? 'יומיים' : `${n} ימים`;
}

/* ---------- views ---------- */
function renderHome() {
  const t = today();
  const sum = L.cycleSummary(state, t);
  const o = sum.overall;
  const fc = focusCat();
  const parts = [];

  // Monthly notices: check-in due, last month's report ready
  const ci = L.checkInStatus(state, t);
  const pend = L.pendingReport(state, t);
  const renew = renewalsDue(t);
  if (ci.due || pend || renew.length) {
    parts.push(`<div class="notices">
      ${renew.map((s) => { const d = L.spreadInfo(s, t).daysToEnd; return `<button type="button" class="notice" data-act="edit-spread" data-id="${s.id}"><span class="notice-k">${esc(s.name)} מתחדש ${d === 0 ? 'היום' : d === 1 ? 'מחר' : `בעוד ${d} ימים`}</span><span class="notice-t">זה הזמן להשוות מחירים לפני שזה מתחדש לבד.</span><span class="notice-go" aria-hidden="true">←</span></button>`; }).join('')}
      ${ci.due ? `<button type="button" class="notice" data-act="checkin"><span class="notice-k">צ׳ק־אין ${esc(L.MONTHS[Number(ci.period.slice(5, 7)) - 1])}</span><span class="notice-t">כמה נכנס, כמה בעו״ש ובהשקעות. דקה אחת.</span><span class="notice-go" aria-hidden="true">←</span></button>` : ''}
      ${pend ? `<button type="button" class="notice" data-act="report" data-start="${pend.start}"><span class="notice-k">הסיכום של ${esc(L.cycleLabel(pend))} מוכן</span><span class="notice-t">הוצאות מול הכנסות, ואיפה אפשר להשתפר.</span><span class="notice-go" aria-hidden="true">←</span></button>` : ''}
    </div>`);
  }

  // Hero: what you can still spend today
  if (o.hasBudget) {
    const neg = o.todayLeft < 0;
    parts.push(`<section class="hero vault" aria-labelledby="hero-l">
      <p class="eyebrow" id="hero-l">${neg ? 'חרגת היום ב־' : 'אפשר להוציא היום'}</p>
      <p class="hero-num ${neg ? 'neg' : ''}">${m(Math.abs(o.todayLeft), { round: true })}</p>
      <p class="hero-sub">${o.left >= 0
        ? `נשארו <strong>${m(o.left, { round: true })}</strong> עד ${endLabel(sum.cycle)} — ${daysWord(o.daysLeft)}, בערך ${m(o.daysLeft ? Math.floor(o.left / o.daysLeft) : 0, { round: true })} ליום.`
        : `עברת את התקציב החודשי ב־<strong>${m(-o.left, { round: true })}</strong>. מכאן כל שקל שנחסך מקטין את החור.`}
        ${o.reserved ? `<br><span class="small muted">כולל ${m(o.reserved, { round: true })} לחיובים קבועים שעוד יגיעו.</span>` : ''}
        ${o.derived ? `<br><span class="small muted">לפי סכום המעטפות. קטגוריות בלי תקציב לא נספרות כאן.</span>` : ''}</p>
    </section>`);
  } else {
    parts.push(`<section class="hero vault">
      <p class="eyebrow">הוצאת במחזור הזה</p>
      <p class="hero-num">${m(o.spent, { round: true })}</p>
      <p class="hero-sub">אין עדיין תקציב חודשי, אז אין למה להשוות. <button type="button" class="link link-on-dark" data-act="settings">להגדיר תקציב</button></p>
    </section>`);
  }

  // Alerts
  const alerts = [];
  for (const { cat, status } of sum.cats) {
    if (!status.hasBudget) continue;
    if (status.state === 'over') alerts.push({ over: true, text: `חרגת ב${esc(cat.name)} ב־${m(-status.left)}` });
    else if (status.willOverrun) alerts.push({ text: `${esc(cat.name)}: לפי הקצב הנוכחי — ${m(status.projected, { round: true })} עד סוף המחזור, מתוך ${m(status.budget, { round: true })}` });
    else if (status.state === 'warn') alerts.push({ text: `${esc(cat.name)}: נשארו רק ${m(status.left)}` });
  }
  if (alerts.length) {
    parts.push(`<ul class="alerts" aria-label="התראות תקציב">${alerts.map((a) => `<li class="${a.over ? 'is-over' : ''}"><span>${a.text}</span></li>`).join('')}</ul>`);
  }

  // Focus envelope (eating out by default)
  if (fc) {
    const row = sum.cats.find((r) => r.cat.id === fc.id);
    const st = row.status;
    const habit = L.categoryHabit(state, fc.id, t);
    let lines = '';
    if (st.hasBudget) {
      if (st.state === 'over') {
        lines += `<p class="focus-line neg"><strong>חריגה של ${m(-st.left)}.</strong> כל הוצאה נוספת כאן — מעל התקציב.</p>`;
      } else {
        lines += `<p class="focus-line">נשארו <strong>${m(st.left)}</strong> · עד ${m(st.perDay, { round: true })} ליום${st.current ? ` · היום: ${st.todayLeft >= 0 ? `עוד ${m(st.todayLeft, { round: true })}` : `<span class="neg">חריגה של ${m(-st.todayLeft, { round: true })}</span>`}` : ''}</p>`;
        if (st.willOverrun) lines += `<p class="focus-line warn-text">בקצב הזה: ${m(st.projected, { round: true })} עד סוף המחזור.</p>`;
      }
    } else {
      lines += `<p class="focus-line">אין תקציב לקטגוריה הזו. <button type="button" class="link" data-act="set-focus-budget">לקבוע תקציב</button></p>`;
    }
    const tip = habit && habit.perWeek >= 1
      ? `<p class="focus-tip">בממוצע ${m(habit.avg, { round: true })} לפעם, ${habit.perWeek.toFixed(1)} פעמים בשבוע. פעם אחת פחות בשבוע = <strong>${m(habit.yearlyIfOneLessPerWeek, { round: true })} בשנה</strong>.</p>`
      : '';
    parts.push(`<section class="focus" aria-labelledby="focus-name">
      <div class="focus-row">
        <h2 class="focus-name" id="focus-name">${esc(fc.name)}</h2>
        <span class="focus-amt">${m(st.spent, { round: true })}${st.hasBudget ? ` <span class="of">/ ${m(st.budget, { round: true })}</span>` : ''}</span>
      </div>
      ${bar(st)}
      ${lines}
      ${tip}
      <div class="focus-actions">
        <button type="button" class="link" data-act="add" data-cat="${fc.id}">לרשום ${esc(fc.name)}</button>
        <button type="button" class="link" data-act="resist" data-cat="${fc.id}">ויתרתי הפעם</button>
      </div>
    </section>`);
  }

  // Envelopes
  const budgeted = sum.cats.filter((r) => r.status.hasBudget && (!fc || r.cat.id !== fc.id));
  const unbudgeted = sum.cats.filter((r) => !r.status.hasBudget && r.status.spent > 0 && (!fc || r.cat.id !== fc.id));
  if (budgeted.length || unbudgeted.length) {
    parts.push(`<section aria-labelledby="env-h">
      <div class="sec-head"><h2 class="sec-title" id="env-h">מעטפות</h2><button type="button" class="link" data-act="settings">עריכת תקציבים</button></div>
      <ul class="env-list">
        ${budgeted.map(({ cat, status: st }) => `<li class="env">
          <button type="button" class="env-btn" data-act="ledger-cat" data-cat="${cat.id}" aria-label="${esc(cat.name)}: ${esc(money(st.spent))} מתוך ${esc(money(st.budget))}. פתיחה ביומן">
            <div class="env-top"><span class="env-name"><i class="dot" style="background:${cat.color}"></i>${esc(cat.name)}</span><span class="env-amt">${m(st.spent, { round: true })} <span class="of">/ ${m(st.budget, { round: true })}</span></span></div>
            ${bar(st)}
            <p class="env-note ${st.state === 'over' ? 'is-over' : st.state === 'warn' ? 'is-warn' : ''}">${st.state === 'over' ? `חריגה של ${m(-st.left)}` : `נשארו ${m(st.left)}${st.reserved ? ` (אחרי ${m(st.reserved, { round: true })} קבועים)` : ''}`}</p>
          </button>
        </li>`).join('')}
        ${unbudgeted.map(({ cat, status: st }) => `<li class="env">
          <button type="button" class="env-btn" data-act="ledger-cat" data-cat="${cat.id}">
            <div class="env-top"><span class="env-name"><i class="dot" style="background:${cat.color}"></i>${esc(cat.name)}</span><span class="env-amt">${m(st.spent, { round: true })}</span></div>
            <p class="env-note">ללא תקציב</p>
          </button>
        </li>`).join('')}
      </ul>
    </section>`);
  }

  // Upcoming fixed charges
  if (sum.upcoming.length) {
    parts.push(`<section aria-labelledby="up-h">
      <div class="sec-head"><h2 class="sec-title" id="up-h">חיובים קבועים בהמשך</h2></div>
      <ul class="plain-list">${sum.upcoming.map((u) => `<li><span>${esc(u.item.name)} <span class="small muted">· ${esc(L.dayLabel(u.date))}</span></span>${m(u.item.amount)}</li>`).join('')}</ul>
    </section>`);
  }

  // Recent
  const recent = state.expenses.filter((e) => e.date <= t).sort(byNewest).slice(0, 5);
  if (recent.length) {
    parts.push(`<section aria-labelledby="rec-h" class="block-recent">
      <div class="sec-head"><h2 class="sec-title" id="rec-h">אחרונות</h2><button type="button" class="link" data-act="tab" data-tab="ledger">לכל היומן</button></div>
    </section>
    <ul class="rows">${recent.map((e) => expenseRow(e, t, true)).join('')}</ul>`);
  } else {
    parts.push(`<section class="empty">
      <h2>הפנקס ריק</h2>
      <p>רושמים כל הוצאה ברגע שהיא קורית — לוקח חמש שניות, ובסוף החודש יודעים בדיוק לאן הלך הכסף.</p>
      <button type="button" class="btn btn-primary" data-act="add">לרשום הוצאה ראשונה</button>
    </section>`);
  }

  // Backup reminder
  const daysSinceBackup = state.settings.lastBackupAt ? Math.floor((Date.now() - state.settings.lastBackupAt) / 86400000) : null;
  if (state.expenses.length >= 15 && (daysSinceBackup === null || daysSinceBackup > 30)) {
    parts.push(`<div class="hint-box" style="margin-top:26px"><strong>${daysSinceBackup === null ? 'עוד לא גיבית' : `הגיבוי האחרון לפני ${daysSinceBackup} ימים`}</strong>הנתונים שמורים רק בטלפון הזה. <button type="button" class="link" data-act="backup">לשמור גיבוי עכשיו</button></div>`);
  }

  // Install hint (iPhone Safari, not installed yet)
  if (isIOS() && !isStandalone() && !state.settings.installHintDismissed) {
    parts.splice(1, 0, `<div class="hint-box" role="note"><strong>להוסיף למסך הבית</strong>בספארי: כפתור השיתוף (ריבוע עם חץ למעלה) ← ״הוספה למסך הבית״. כך פנקס נפתח כמו אפליקציה ושומר את הנתונים לתמיד.
      <br><button type="button" class="link" data-act="dismiss-install">הבנתי</button></div>`);
  }

  return parts.join('');
}

function byNewest(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.createdAt || 0) - (a.createdAt || 0);
}

function expenseRow(e, t, showDate = false) {
  const c = catById(e.catId);
  const title = e.note || c?.name || 'הוצאה';
  const sub = [
    c ? `<i class="dot" style="background:${c.color}"></i>${esc(c.name)}` : '',
    showDate ? esc(L.dayLabel(e.date, t)) : '',
  ].filter(Boolean).join(' · ');
  return `<li><button type="button" class="row-btn" data-act="edit" data-id="${e.id}" aria-label="${esc(title)}, ${esc(money(e.amount))}${c ? `, ${esc(c.name)}` : ''}. עריכה">
    <span class="row-main"><span class="row-title">${esc(title)}</span><span class="row-sub">${sub}${e.spreadId ? ' <span class="tag">פריסה</span>' : e.recurringId ? ' <span class="tag">קבועה</span>' : ''}</span></span>
    <span class="row-amt">${m(e.amount)}</span>
  </button></li>`;
}

function ledgerCycle() {
  return L.shiftCycle(L.cycleFor(today(), state.settings.cycleDay), ui.ledgerOffset);
}

function incomeRow(i, t, showDate = false) {
  const title = i.note || i.source;
  return `<li><button type="button" class="row-btn" data-act="edit-income" data-id="${i.id}" aria-label="הכנסה: ${esc(title)}, ${esc(money(i.amount))}. עריכה">
    <span class="row-main"><span class="row-title">${esc(title)}</span><span class="row-sub"><span class="tag tag-in">הכנסה</span> ${esc(i.source)}${showDate ? ` · ${esc(L.dayLabel(i.date, t))}` : ''}</span></span>
    <span class="row-amt pos">${m(i.amount, { signed: true })}</span>
  </button></li>`;
}

function renderLedger() {
  const cycle = ledgerCycle();
  const exps = L.expensesInCycle(state.expenses, cycle).filter((e) => e.date <= today() || ui.ledgerOffset < 0);
  const incs = L.incomesInCycle(state, cycle);
  const spent = L.sumBy(exps);
  const earned = L.sumBy(incs);
  const catOptions = state.categories.map((c) => `<option value="${c.id}" ${ui.ledgerCat === c.id ? 'selected' : ''}>${esc(c.name)}${c.archived ? ' (בארכיון)' : ''}</option>`).join('');
  const view = ui.ledgerView;
  return `<div class="cycle-nav">
      <button type="button" data-act="ledger-prev" aria-label="למחזור הקודם">→</button>
      <div class="cycle-nav-label" aria-live="polite"><strong>${esc(L.cycleLabel(cycle))}</strong></div>
      <button type="button" data-act="ledger-next" aria-label="למחזור הבא" ${ui.ledgerOffset >= 0 ? 'disabled' : ''}>←</button>
    </div>
    <dl class="ledger-sum">
      <div><dt>הכנסות</dt><dd class="pos">${m(earned, { round: true })}</dd></div>
      <div><dt>הוצאות</dt><dd>${m(spent, { round: true })}</dd></div>
      <div><dt>יתרה</dt><dd class="${earned - spent < 0 ? 'neg' : ''}">${m(earned - spent, { round: true })}</dd></div>
    </dl>
    <div class="ledger-tools">
      <div class="seg" role="radiogroup" aria-label="תצוגה">
        <label><input type="radio" name="lview" value="list" data-ledger-view ${view === 'list' ? 'checked' : ''}><span>רשימה</span></label>
        <label><input type="radio" name="lview" value="cal" data-ledger-view ${view === 'cal' ? 'checked' : ''}><span>לוח חודשי</span></label>
      </div>
    </div>
    ${view === 'cal' ? renderLedgerCalendar(cycle) : ''}
    <div class="filters">
      <label class="sr-only" for="lq">חיפוש ביומן</label>
      <input id="lq" class="field" type="search" placeholder="חיפוש" value="${esc(ui.ledgerQuery)}" autocomplete="off" enterkeyhint="search">
      <label class="sr-only" for="lc">סינון לפי קטגוריה</label>
      <select id="lc" class="field"><option value="">כל הקטגוריות</option>${catOptions}</select>
    </div>
    <div id="ledger-results">${renderLedgerResults()}</div>`;
}

// short number for a narrow calendar cell: 75, 1.2K, 15K (the full amount is in the cell's label)
function cellNum(a) {
  const v = Math.round(a / 100);
  if (v < 1000) return String(v);
  return (Math.floor(v / 100) / 10).toFixed(v < 100000 ? 1 : 0).replace(/\.0$/, '') + 'K';
}

// Month grid with each day's spending and income
function renderLedgerCalendar(cycle) {
  const t = today();
  const totals = L.dailyTotals(state, cycle);
  const firstDow = L.fromISO(cycle.start).getDay();
  const cells = [];
  for (let d = cycle.start; d < cycle.end; d = L.addDays(d, 1)) {
    const x = totals.get(d) || { spent: 0, income: 0 };
    const dd = L.fromISO(d);
    const sel = ui.ledgerDay === d;
    const label = `${dd.getDate()} ב${L.MONTHS_SHORT[dd.getMonth()]}: ${x.spent ? `הוצאות ${money(x.spent)}` : 'בלי הוצאות'}${x.income ? `, הכנסות ${money(x.income)}` : ''}`;
    cells.push(`<button type="button" class="calx-day${d === t ? ' is-today' : ''}${d > t ? ' is-future' : ''}" data-act="ledger-day" data-date="${d}" aria-pressed="${sel}" aria-label="${esc(label)}">
      <span class="calx-n">${dd.getDate()}</span>
      ${x.spent ? `<span class="calx-out" aria-hidden="true">${esc(cellNum(x.spent))}</span>` : ''}
      ${x.income ? `<span class="calx-in" aria-hidden="true">+${esc(cellNum(x.income))}</span>` : ''}
    </button>`);
  }
  return `<div class="calx" role="group" aria-label="לוח המחזור: לחיצה על יום מציגה את הרישומים שלו">
    ${L.WEEKDAYS_SHORT.map((w) => `<span class="cal-wd" aria-hidden="true">${w}</span>`).join('')}
    ${Array.from({ length: firstDow }, () => '<span aria-hidden="true"></span>').join('')}
    ${cells.join('')}
  </div>`;
}

function renderLedgerResults() {
  const t = today();
  const cycle = ledgerCycle();
  const q = ui.ledgerQuery.trim().toLowerCase();
  let list = L.expensesInCycle(state.expenses, cycle);
  // future-dated fixed shares (insurance) stay out of the current month's list until their day
  if (ui.ledgerOffset >= 0) list = list.filter((e) => e.date <= t || e.date === ui.ledgerDay);
  let incs = ui.ledgerCat ? [] : L.incomesInCycle(state, cycle);
  if (ui.ledgerCat) list = list.filter((e) => e.catId === ui.ledgerCat);
  if (ui.ledgerDay) {
    list = list.filter((e) => e.date === ui.ledgerDay);
    incs = incs.filter((i) => i.date === ui.ledgerDay);
  }
  if (q) {
    list = list.filter((e) => (e.note || '').toLowerCase().includes(q) || (catById(e.catId)?.name || '').includes(q) || String(e.amount / 100).includes(q));
    incs = incs.filter((i) => (i.note || '').toLowerCase().includes(q) || i.source.includes(q) || String(i.amount / 100).includes(q));
  }
  list.sort(byNewest);
  const filtered = q || ui.ledgerCat || ui.ledgerDay;

  const groups = new Map();
  const g = (d) => {
    if (!groups.has(d)) groups.set(d, { exps: [], incs: [] });
    return groups.get(d);
  };
  for (const e of list) g(e.date).exps.push(e);
  for (const i of incs) g(i.date).incs.push(i);
  const days = [...groups.keys()].sort().reverse();
  const count = list.length + incs.length;

  return `<div class="ledger-total"><span class="muted small">${count ? `${count} רשומות${ui.ledgerDay ? ` ב${esc(L.dayLabel(ui.ledgerDay, t))}` : ''}` : ''}</span>
      ${ui.ledgerDay ? '<button type="button" class="link small" data-act="ledger-all-days">כל הימים</button>' : `<span class="num">${esc(money(L.sumBy(list), { round: true }))}</span>`}</div>
    <div class="ledger-wrap">
    ${count
      ? days.map((date) => {
          const { exps, incs: ins } = groups.get(date);
          return `<div class="day-group">
          <div class="day-head"><span>${esc(L.dayLabel(date, t))}</span><span>${ins.length ? `<span class="pos">${m(L.sumBy(ins), { signed: true })}</span> ` : ''}${exps.length ? m(L.sumBy(exps)) : ''}</span></div>
          <ul class="rows">${ins.map((i) => incomeRow(i, t)).join('')}${exps.map((e) => expenseRow(e, t)).join('')}</ul>
        </div>`;
        }).join('')
      : `<section class="empty"><h2>${filtered ? 'לא נמצאו רישומים' : 'אין רישומים במחזור הזה'}</h2>
          <p>${ui.ledgerDay && !q && !ui.ledgerCat ? 'ביום הזה לא נרשם כלום.' : filtered ? 'נסו מילה אחרת או בטלו את הסינון.' : 'כל הוצאה והכנסה שתרשמו תופיע כאן, מסודרת לפי ימים.'}</p>
          ${filtered ? '<button type="button" class="btn btn-line" data-act="clear-filter">ביטול הסינון</button>' : '<button type="button" class="btn btn-primary" data-act="add">לרשום הוצאה</button>'}</section>`}
    </div>`;
}

function sparkline(values, { w = 300, h = 54, label = '' } = {}) {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  // RTL: oldest on the right, newest on the left
  const pts = values.map((v, i) => [w - (i / (values.length - 1)) * w, h - 6 - ((v - min) / span) * (h - 12)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5" class="spark-dot"/></svg>`;
}

function renderNetWorth() {
  const series = L.netWorthSeries(state.snapshots);
  const ci = L.checkInStatus(state, today());
  if (!series.length) {
    return `<section class="vault nw" aria-labelledby="nw-h">
      <p class="vault-label" id="nw-h">השווי שלך</p>
      <p class="nw-empty">כמה שווה כל הכסף שלך — עו״ש, השקעות וחיסכון? פעם בחודש, ב־${state.settings.checkInDay} לחודש, מזינים שלושה מספרים ורואים את ההון גדל.</p>
      <button type="button" class="btn btn-gold" data-act="checkin">צ׳ק־אין ראשון</button>
    </section>`;
  }
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const change = prev ? last.total - prev.total : null;
  const parts = [
    ['עו״ש ומזומן', last.cash, 'seg-cash'],
    ['השקעות', last.investments, 'seg-inv'],
    ['חיסכון', last.savings, 'seg-sav'],
  ];
  const total = Math.max(1, last.total);
  const seg = parts.filter((p) => p[1] > 0).map((p) => `<span class="${p[2]}" style="width:${((p[1] / total) * 100).toFixed(1)}%"></span>`).join('');
  const label = `השווי לאורך ${series.length} חודשים: ` + series.map((s) => `${L.monthLabelFromKey(s.period)} ${money(s.total, { round: true })}`).join(', ');
  return `<section class="vault nw" aria-labelledby="nw-h">
    <div class="nw-top">
      <p class="vault-label" id="nw-h">השווי שלך · ${esc(L.monthLabelFromKey(last.period))}</p>
      <button type="button" class="link link-on-dark" data-act="checkin" data-period="${ci.due ? ci.period : last.period}">${ci.due ? 'צ׳ק־אין חדש' : 'עדכון'}</button>
    </div>
    <p class="nw-num">${m(last.total, { round: true })}</p>
    ${change !== null ? `<p class="nw-change ${change >= 0 ? 'up' : 'down'}">${change >= 0 ? '▲' : '▼'} ${m(Math.abs(change), { round: true })} מהחודש הקודם</p>` : ''}
    ${sparkline(series.map((s) => s.total), { label })}
    <div class="nw-bar" aria-hidden="true">${seg}</div>
    <ul class="nw-legend">${parts.map((p) => `<li><i class="${p[2]}" aria-hidden="true"></i><span>${p[0]}</span>${m(p[1], { round: true })}</li>`).join('')}</ul>
  </section>`;
}

function renderSave() {
  const t = today();
  const cycle = L.cycleFor(t, state.settings.cycleDay);
  const resistedNow = state.resisted.filter((r) => L.inCycle(r.date, cycle));
  const resistedTotal = L.sumBy(state.resisted);
  const skippedWishes = state.wishlist.filter((w) => w.status === 'skipped');
  const parts = [renderNetWorth()];

  parts.push(`<section class="save-intro" aria-labelledby="res-h">
    <p class="eyebrow" id="res-h">נשאר אצלך בזכות ויתורים, במחזור הזה</p>
    <p class="big-stat">${m(L.sumBy(resistedNow), { round: true })}</p>
    <p class="muted small">${resistedTotal ? `מאז שהתחלת: ${m(resistedTotal, { round: true })} ב־${state.resisted.length} ויתורים` : 'ויתרת על קפה, משלוח או קנייה? לרשום את זה כאן — זה כסף שנשאר.'}</p>
    <button type="button" class="btn btn-primary" data-act="resist">ויתרתי על משהו</button>
  </section>`);

  if (resistedNow.length) {
    parts.push(`<section><ul class="plain-list">${[...resistedNow].reverse().slice(0, 6).map((r) => `<li><span>${esc(r.name || 'ויתור')} <span class="small muted">· ${esc(L.dayLabel(r.date, t))}</span></span><span>${m(r.amount)} <button type="button" class="link small" data-act="del-resist" data-id="${r.id}" aria-label="מחיקת הוויתור ${esc(r.name)}">מחיקה</button></span></li>`).join('')}</ul></section>`);
  }

  // Goals
  parts.push(`<section aria-labelledby="goals-h">
    <div class="sec-head"><h2 class="sec-title" id="goals-h">מטרות חיסכון</h2><button type="button" class="link" data-act="new-goal">מטרה חדשה</button></div>
    ${state.goals.length ? state.goals.map((g) => {
      const ratio = Math.min(1, g.saved / g.target);
      const done = g.saved >= g.target;
      return `<div class="goal">
        <div class="goal-top"><span class="goal-name">${esc(g.name)}</span><span>${m(g.saved, { round: true })} <span class="muted small">/ ${m(g.target, { round: true })}</span></span></div>
        <div class="bar" role="img" aria-label="${Math.round(ratio * 100)} אחוז מהמטרה"><span class="bar-fill" style="width:${(ratio * 100).toFixed(1)}%"></span></div>
        <div class="goal-actions">
          <span class="small ${done ? 'pos' : 'muted'}">${done ? 'הושגה!' : `חסרים ${m(g.target - g.saved, { round: true })}`}</span>
          <button type="button" class="link" data-act="deposit" data-id="${g.id}">הפקדה</button>
          <button type="button" class="link" data-act="edit-goal" data-id="${g.id}">עריכה</button>
        </div>
      </div>`;
    }).join('') : `<p class="block-p">למה חוסכים? טיסה, מחשב, כרית ביטחון. מטרה עם שם ומספר עוזרת לוותר בקלות.</p>`}
  </section>`);

  // Wishlist / cooling-off
  const waiting = state.wishlist.filter((w) => w.status === 'waiting').sort((a, b) => a.addedAt - b.addedAt);
  parts.push(`<section class="section-gap" aria-labelledby="wish-h">
    <div class="sec-head"><h2 class="sec-title" id="wish-h">רשימת המתנה</h2><button type="button" class="link" data-act="new-wish">להוסיף</button></div>
    <p class="block-p">רוצה לקנות משהו שלא תכננת? מכניסים אותו לכאן ל־${state.settings.waitHours} שעות. אם עדיין רוצה אחרי זה — קונים בלב שלם.</p>
    ${waiting.map((w) => {
      const ws = L.wishState(w);
      return `<div class="wish">
        <div class="wish-top"><strong>${esc(w.name)}</strong>${m(w.amount)}</div>
        <p class="wish-status ${ws.ready ? 'ready' : ''}">${ws.ready ? 'זמן ההמתנה נגמר. עדיין רוצה?' : `${esc(L.formatWait(ws.msLeft))} של המתנה`}</p>
        <div class="wish-actions">
          ${ws.ready ? `<button type="button" class="btn btn-small btn-primary" data-act="wish-skip" data-id="${w.id}">ויתרתי</button>
          <button type="button" class="btn btn-small btn-line" data-act="wish-buy" data-id="${w.id}">קניתי</button>` : `<button type="button" class="btn btn-small btn-line" data-act="wish-skip" data-id="${w.id}">כבר לא רוצה</button>`}
          <button type="button" class="link small" data-act="wish-del" data-id="${w.id}">הסרה</button>
        </div>
      </div>`;
    }).join('')}
    ${skippedWishes.length ? `<p class="small muted" style="margin-top:10px">ויתרת על ${skippedWishes.length} דברים מהרשימה — ${m(L.sumBy(skippedWishes), { round: true })} שנשארו בכיס.</p>` : ''}
  </section>`);

  // No-spend calendar
  const cal = L.noSpendCalendar(state, cycle, t);
  const firstDow = L.fromISO(cycle.start).getDay();
  parts.push(`<section class="section-gap" aria-labelledby="cal-h">
    <div class="sec-head"><h2 class="sec-title" id="cal-h">ימים בלי הוצאות</h2></div>
    <p class="block-p">${cal.noSpend ? `${cal.noSpend} ימים בלי אף הוצאה במחזור הזה${cal.streak > 1 ? `, ${cal.streak} ברצף עד אתמול` : ''}.` : 'יום שבו לא הוצאת כלום (מלבד חיובים קבועים) נצבע בירוק. נסו לצבוע שניים בשבוע.'}</p>
    <div class="cal" role="list" aria-label="לוח המחזור">
      ${L.WEEKDAYS_SHORT.map((d) => `<span class="cal-wd" aria-hidden="true">${d}</span>`).join('')}
      ${Array.from({ length: firstDow }, () => '<span aria-hidden="true"></span>').join('')}
      ${cal.days.map((d) => {
        const dd = L.fromISO(d.date);
        const cls = d.today ? 'is-today' : d.future ? 'is-future' : d.spent ? 'is-spent' : 'is-free';
        const label = `${dd.getDate()} ב${L.MONTHS_SHORT[dd.getMonth()]}: ${d.future ? 'עוד לא הגיע' : d.spent ? `הוצאת ${money(d.spent)}` : d.today ? 'היום' : 'בלי הוצאות'}`;
        return `<span class="cal-day ${cls}" role="listitem" aria-label="${esc(label)}">${dd.getDate()}</span>`;
      }).join('')}
    </div>
    <div class="cal-legend" aria-hidden="true"><span><i style="background:var(--good)"></i>בלי הוצאות</span><span><i style="background:var(--paper-2);border:1px solid var(--rule-soft)"></i>היו הוצאות</span></div>
  </section>`);

  return parts.join('');
}

function renderInsights() {
  const t = today();
  const totals = L.cycleTotals(state, t, 6);
  // only an explicit monthly total is comparable to *all* spending
  const budget = state.settings.monthlyBudget || 0;
  const parts = [];

  if (!state.expenses.length) {
    return `<section class="empty"><h2>אין עדיין מה לנתח</h2><p>אחרי שבוע־שבועיים של רישום יופיעו כאן השוואות, הימים היקרים בשבוע, וכמה עולים המנויים בשנה.</p><button type="button" class="btn btn-primary" data-act="add">לרשום הוצאה</button></section>`;
  }

  // Where to improve — this cycle so far
  const curCycle = L.cycleFor(t, state.settings.cycleDay);
  const tips = L.improvementTips(state, curCycle, t, 3);
  parts.push(`<section aria-labelledby="tips-h">
    <div class="sec-head"><h2 class="sec-title" id="tips-h">איפה אפשר להשתפר</h2><span class="small muted">המחזור הנוכחי</span></div>
    ${tips.length ? tipsList(tips) : '<p class="block-p">בינתיים אין כאן מה לתקן. ההוצאות בקצב טוב.</p>'}
  </section>`);

  // Where the money went — ranked bars, one hue, largest first
  const shares = L.categoryShares(state, curCycle);
  if (shares.length) {
    const max = shares[0].amount;
    parts.push(`<section class="section-gap" aria-labelledby="sh-h">
      <div class="sec-head"><h2 class="sec-title" id="sh-h">לאן הלך הכסף</h2><span class="small muted">המחזור הנוכחי</span></div>
      <ul class="shares">${shares.map((r) => `<li>
        <span class="sh-name"><i class="dot" style="background:${r.cat.color}" aria-hidden="true"></i>${esc(r.cat.name)}</span>
        <span class="sh-bar" aria-hidden="true"><span style="width:${((r.amount / max) * 100).toFixed(1)}%"></span></span>
        <span class="sh-val">${m(r.amount, { round: true })} <span class="muted">${Math.round(r.share * 100)}%</span></span>
      </li>`).join('')}</ul>
    </section>`);
  }

  // Monthly reports
  const reports = [];
  for (let i = 1; i <= 12 && reports.length < 6; i++) {
    const c = L.shiftCycle(curCycle, -i);
    const spent = L.sumBy(L.expensesInCycle(state.expenses, c));
    if (spent) reports.push({ c, spent, inc: L.incomeForCycle(state, c).amount });
  }
  if (reports.length) {
    parts.push(`<section class="section-gap" aria-labelledby="rep-h">
      <div class="sec-head"><h2 class="sec-title" id="rep-h">סיכומים חודשיים</h2></div>
      <ul class="rows report-list">${reports.map(({ c, spent, inc }) => `<li><button type="button" class="row-btn" data-act="report" data-start="${c.start}">
        <span class="row-main"><span class="row-title">${esc(L.cycleLabel(c))}</span><span class="row-sub">${inc ? `הכנסות ${esc(money(inc, { round: true }))} · ${inc - spent >= 0 ? 'נשאר' : 'חסר'} ${esc(money(Math.abs(inc - spent), { round: true }))}` : 'בלי נתוני הכנסה'}</span></span>
        <span class="row-amt">${m(spent, { round: true })}</span>
      </button></li>`).join('')}</ul>
    </section>`);
  }

  // Your places this cycle
  const places = L.learnPlaces(L.expensesInCycle(state.expenses, curCycle), state.placePrefs).sort((a, b) => b.total - a.total).slice(0, 5);
  if (places.length) {
    parts.push(`<section class="section-gap" aria-labelledby="pl-h">
      <div class="sec-head"><h2 class="sec-title" id="pl-h">המקומות שלך</h2><span class="small muted">המחזור הנוכחי</span></div>
      <ul class="kv">${places.map((p) => `<li><span>${esc(p.name)} <span class="small muted">· ${p.count} פעמים · ממוצע ${esc(money(p.avg, { round: true }))}</span></span>${m(p.total, { round: true })}</li>`).join('')}</ul>
    </section>`);
  }

  // Bar chart, newest on the left (RTL reading order)
  const W = 340, H = 170, pad = 24, gap = 12;
  const maxV = Math.max(budget || 0, ...totals.map((x) => x.total), 1);
  const bw = (W - gap * (totals.length - 1)) / totals.length;
  const y = (v) => H - pad - (v / maxV) * (H - pad * 2);
  const ordered = [...totals].reverse(); // index 0 = newest -> leftmost
  const bars = ordered.map((x, i) => {
    const bx = i * (bw + gap);
    const by = y(x.total);
    return `<rect class="b ${x.current ? 'cur' : ''}" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - pad - by).toFixed(1)}" rx="2"></rect>
      <text class="val" x="${(bx + bw / 2).toFixed(1)}" y="${(by - 6).toFixed(1)}" text-anchor="middle">${esc(compact(x.total))}</text>
      <text x="${(bx + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(L.shortCycleLabel(x.cycle))}</text>`;
  }).join('');
  const bl = budget ? `<line class="budget-line" x1="0" x2="${W}" y1="${y(budget).toFixed(1)}" y2="${y(budget).toFixed(1)}"></line><text class="budget-label" x="${W - 2}" y="${(y(budget) - 4).toFixed(1)}" text-anchor="end">תקציב ${esc(compact(budget))}</text>` : '';
  const desc = totals.map((x) => `${L.cycleLabel(x.cycle)}: ${money(x.total, { round: true })}`).join('; ');
  parts.push(`<section class="section-gap" aria-labelledby="ch-h">
    <div class="sec-head"><h2 class="sec-title" id="ch-h">שישה מחזורים אחרונים</h2></div>
    <figure style="margin:0">
      <svg class="chart" viewBox="0 -8 ${W} ${H + 8}" role="img" aria-label="${esc('סך ההוצאות לפי מחזור. ' + desc)}">${bl}${bars}</svg>
      <figcaption class="small muted">${budget ? 'הקו המקווקו — התקציב החודשי. ' : ''}המחזור הנוכחי בצבע מלא${totals[totals.length - 1].current ? ' (עדיין לא נגמר)' : ''}.</figcaption>
    </figure>
  </section>`);

  // Compare categories
  const cmp = L.categoryCompare(state, t);
  if (cmp.length) {
    parts.push(`<section class="section-gap" aria-labelledby="cmp-h">
      <div class="sec-head"><h2 class="sec-title" id="cmp-h">מול המחזור הקודם</h2></div>
      <p class="block-p">השוואה הוגנת: מול אותה נקודת זמן במחזור הקודם.</p>
      <table class="cmp">
        <thead><tr><th scope="col">קטגוריה</th><th scope="col">עכשיו</th><th scope="col">אז</th><th scope="col">הפרש</th></tr></thead>
        <tbody>${cmp.map((r) => `<tr><th scope="row" style="font-weight:500;text-align:start"><i class="dot" style="background:${r.cat.color}"></i> ${esc(r.cat.name)}</th><td>${m(r.now, { round: true })}</td><td class="muted">${m(r.before, { round: true })}</td><td class="${r.delta > 0 ? 'neg' : r.delta < 0 ? 'pos' : 'muted'}">${r.delta ? m(r.delta, { round: true, signed: true }) : '—'}</td></tr>`).join('')}</tbody>
      </table>
    </section>`);
  }

  // Weekday pattern over last 3 cycles
  const from = L.shiftCycle(L.cycleFor(t, state.settings.cycleDay), -2).start;
  const wd = L.weekdayPattern(state.expenses.filter((e) => e.date >= from));
  const wdMax = Math.max(...wd.map((d) => d.total), 1);
  const top = wd.reduce((a, b) => (b.total > a.total ? b : a), wd[0]);
  if (top.total > 0) {
    parts.push(`<section aria-labelledby="wd-h">
      <div class="sec-head"><h2 class="sec-title" id="wd-h">ימים יקרים</h2></div>
      <p class="block-p">ביום ${L.WEEKDAYS[top.day]} הולך הכי הרבה כסף (שלושה מחזורים אחרונים, בלי חיובים קבועים). שווה לתכנן אותו מראש.</p>
      <ul class="wd">${wd.map((d) => `<li class="${d.day === top.day ? 'is-top' : ''}"><span>${L.WEEKDAYS[d.day]}</span><div class="bar" aria-hidden="true"><span class="bar-fill" style="width:${((d.total / wdMax) * 100).toFixed(1)}%"></span></div>${m(d.total, { round: true })}</li>`).join('')}</ul>
    </section>`);
  }

  // Insurance & annual expenses
  const st = L.spreadTotals(state.spreads, t);
  if (st.count) {
    parts.push(`<section aria-labelledby="sp-h">
      <div class="sec-head"><h2 class="sec-title" id="sp-h">ביטוחים ושנתיות</h2><button type="button" class="link" data-act="settings-spreads">ניהול</button></div>
      <p class="callout">${st.count === 1 ? 'הוצאה שנתית אחת פרוסה' : `${st.count} הוצאות שנתיות פרוסות`} על החודשים: ${m(st.monthly, { round: true })} בכל חודש, ${m(st.yearly, { round: true })} בשנה.</p>
    </section>`);
  }

  // Fixed costs
  const rt = L.recurringTotals(state.recurring);
  parts.push(`<section aria-labelledby="fx-h">
    <div class="sec-head"><h2 class="sec-title" id="fx-h">הוצאות קבועות</h2><button type="button" class="link" data-act="settings-recurring">ניהול</button></div>
    ${rt.count ? `<p class="callout">${rt.count} חיובים קבועים עולים ${m(rt.monthly, { round: true })} בחודש — <strong>${m(rt.yearly, { round: true })} בשנה</strong>. מנוי שלא השתמשת בו החודש? זה הזמן לבטל.</p>
      <ul class="kv">${state.recurring.filter((r) => r.active).sort((a, b) => b.amount - a.amount).map((r) => `<li><span>${esc(r.name)} <span class="small muted">· כל ${r.day} בחודש</span></span><span>${m(r.amount)} <span class="small muted">· ${esc(money(r.amount * 12, { round: true }))} בשנה</span></span></li>`).join('')}</ul>`
      : `<p class="block-p">שכירות, מנויים, ביטוחים — מגדירים פעם אחת והם נרשמים לבד כל חודש, ונשמר להם מקום בתקציב.</p><button type="button" class="btn btn-line btn-small" data-act="new-recurring">הוספת הוצאה קבועה</button>`}
  </section>`);

  // Income vs spending
  const cyc = L.cycleFor(t, state.settings.cycleDay);
  const income = L.incomeForCycle(state, cyc).amount;
  if (income) {
    const spent = L.sumBy(L.expensesInCycle(state.expenses, cyc));
    const reserved = L.upcomingRecurring(state.recurring, cyc, t).reduce((s, u) => s + u.item.amount, 0);
    const left = income - spent - reserved;
    const rate = Math.round((left / income) * 100);
    parts.push(`<section class="section-gap" aria-labelledby="inc-h">
      <div class="sec-head"><h2 class="sec-title" id="inc-h">הכנסה מול הוצאה</h2><button type="button" class="link" data-act="report" data-start="${cyc.start}">דוח מלא</button></div>
      <ul class="kv">
        <li><span>הכנסה החודש</span>${m(income, { round: true })}</li>
        <li><span>הוצאת עד עכשיו</span>${m(spent, { round: true })}</li>
        ${reserved ? `<li><span>חיובים קבועים שעוד יגיעו</span>${m(reserved, { round: true })}</li>` : ''}
        <li><strong>נשאר</strong><strong class="${left < 0 ? 'neg' : ''}">${m(left, { round: true })} <span class="small">(${rate}%)</span></strong></li>
      </ul>
    </section>`);
  }
  return parts.join('');
}

function tipsList(tips) {
  return `<ol class="tips">${tips.map((tp) => `<li>
    <p class="tip-title">${esc(tp.title)}</p>
    <p class="tip-detail">${esc(tp.detail)}</p>
    <p class="tip-save">פוטנציאל: עד ${m(tp.saving, { round: true })} בחודש</p>
  </li>`).join('')}</ol>`;
}

// The check-in month whose check-in date falls inside a cycle
function periodForCycle(cycle) {
  const day = String(state.settings.checkInDay).padStart(2, '0');
  const k = L.monthKey(cycle.start);
  for (const key of [k, L.nextMonthKey(k)]) if (L.inCycle(`${key}-${day}`, cycle)) return key;
  return k;
}

function renderReport() {
  const t = today();
  const c = L.cycleFor(ui.report, state.settings.cycleDay);
  const r = L.monthlyReport(state, c, t);
  const parts = [];
  const maxBar = Math.max(r.income, r.spent, 1);
  const pct = (v) => ((v / maxBar) * 100).toFixed(1);

  parts.push(`<section class="vault report-head" aria-labelledby="rep-title">
    <p class="vault-label" id="rep-title">${esc(L.cycleLabel(c))}${r.complete ? '' : ' · עדיין לא נגמר'}</p>
    ${r.income ? `<p class="eyebrow">${r.left >= 0 ? 'נשאר בסוף החודש' : 'חסר בסוף החודש'}</p>
      <p class="hero-num ${r.left < 0 ? 'neg' : ''}">${m(Math.abs(r.left), { round: true })}</p>
      <p class="hero-sub">${r.left >= 0 ? `שיעור חיסכון: <strong>${Math.round(r.rate * 100)}%</strong> מההכנסה.` : 'ההוצאות עברו את ההכנסה.'}</p>`
    : `<p class="eyebrow">הוצאות במחזור</p><p class="hero-num">${m(r.spent, { round: true })}</p>
      <p class="hero-sub">לא הוזנה הכנסה לחודש הזה, אז אין השוואה. <button type="button" class="link link-on-dark" data-act="checkin" data-period="${periodForCycle(c)}">להזין הכנסה</button></p>`}
  </section>`);

  // income vs expenses
  parts.push(`<section aria-labelledby="ie-h">
    <div class="sec-head"><h2 class="sec-title" id="ie-h">הכנסות מול הוצאות</h2>${r.income ? `<button type="button" class="link" data-act="checkin" data-period="${periodForCycle(c)}">עריכה</button>` : ''}</div>
    <ul class="ie">
      <li class="ie-row"><span class="ie-l">הכנסות</span><span class="ie-v">${m(r.income, { round: true })}</span><span class="ie-bar" aria-hidden="true"><span class="ie-in" style="width:${pct(r.income)}%"></span></span></li>
      <li class="ie-row"><span class="ie-l">הוצאות</span><span class="ie-v">${m(r.spent, { round: true })}</span><span class="ie-bar" aria-hidden="true"><span class="ie-fixed" style="width:${pct(r.fixed)}%"></span><span class="ie-var" style="width:${pct(r.variable)}%"></span></span></li>
    </ul>
    ${r.incomeSource === 'setting' ? '<p class="small muted">אין צ׳ק־אין לחודש הזה, אז ההכנסה לקוחה מההגדרות.</p>' : r.incomeSource === 'entries' ? '<p class="small muted">לפי ההכנסות שרשמת במחזור.</p>' : ''}
    <p class="small muted ie-legend"><span><i class="ie-fixed" aria-hidden="true"></i>קבועות ${m(r.fixed, { round: true })}</span><span><i class="ie-var" aria-hidden="true"></i>משתנות ${m(r.variable, { round: true })}</span></p>
    ${r.prevSpent ? `<p class="block-p">${r.delta > 0 ? `הוצאת <strong class="neg">${m(r.delta, { round: true })} יותר</strong>` : r.delta < 0 ? `הוצאת <strong class="pos">${m(-r.delta, { round: true })} פחות</strong>` : 'הוצאת בדיוק כמו'} לעומת המחזור הקודם (${m(r.prevSpent, { round: true })}).</p>` : ''}
  </section>`);

  // where to improve
  parts.push(`<section class="section-gap" aria-labelledby="imp-h">
    <div class="sec-head"><h2 class="sec-title" id="imp-h">איפה אפשר להשתפר</h2></div>
    ${r.tips.length ? tipsList(r.tips) : '<p class="block-p">חודש נקי: לא נמצאו חריגות או הרגלים יקרים. ככה ממשיכים.</p>'}
  </section>`);

  if (r.wins.length) {
    parts.push(`<section class="section-gap" aria-labelledby="win-h">
      <div class="sec-head"><h2 class="sec-title" id="win-h">מה הלך טוב</h2></div>
      <ul class="wins">${r.wins.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
    </section>`);
  }

  // net worth change
  if (r.startSnap) {
    const rows = [['עו״ש ומזומן', 'cash'], ['השקעות', 'investments'], ['חיסכון', 'savings']];
    parts.push(`<section class="section-gap" aria-labelledby="nwr-h">
      <div class="sec-head"><h2 class="sec-title" id="nwr-h">השווי שלך</h2></div>
      <table class="cmp">
        <thead><tr><th scope="col"><span class="sr-only">סוג</span></th><th scope="col">בתחילה</th><th scope="col">${r.endSnap ? 'אחרי' : 'עכשיו'}</th><th scope="col">שינוי</th></tr></thead>
        <tbody>${rows.map(([l, k]) => {
          const a = r.startSnap[k] || 0;
          const b = r.endSnap ? r.endSnap[k] || 0 : null;
          return `<tr><th scope="row" style="font-weight:500;text-align:start">${l}</th><td>${m(a, { round: true })}</td><td>${b === null ? '—' : m(b, { round: true })}</td><td class="${b === null || b === a ? 'muted' : b > a ? 'pos' : 'neg'}">${b === null || b === a ? '—' : m(b - a, { round: true, signed: true })}</td></tr>`;
        }).join('')}</tbody>
      </table>
      ${r.endSnap ? '' : '<p class="small muted">השינוי יופיע אחרי הצ׳ק־אין של החודש הבא.</p>'}
    </section>`);
  }

  // categories
  parts.push(`<section class="section-gap" aria-labelledby="rc-h">
    <div class="sec-head"><h2 class="sec-title" id="rc-h">לפי קטגוריה</h2></div>
    <table class="cmp">
      <thead><tr><th scope="col">קטגוריה</th><th scope="col">הוצאה</th><th scope="col">תקציב</th></tr></thead>
      <tbody>${r.byCat.map((x) => `<tr><th scope="row" style="font-weight:500;text-align:start"><i class="dot" style="background:${x.cat.color}"></i> ${esc(x.cat.name)}</th><td class="${x.over ? 'neg' : ''}">${m(x.spent, { round: true })}</td><td class="muted">${x.budget ? m(x.budget, { round: true }) : '—'}</td></tr>`).join('')}</tbody>
    </table>
  </section>`);

  return parts.join('');
}

function openReport(start) {
  ui.report = start;
  ui.settings = false;
  const pend = L.pendingReport(state, today());
  if (pend && pend.start === start) {
    state.settings.lastReportSeen = start;
    persist();
  }
  render();
  window.scrollTo(0, 0);
  $('#view').focus({ preventScroll: true });
}

function compact(a) {
  const v = Math.round(a / 100);
  if (v >= 1000) return cur() + (v / 1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return cur() + v;
}

function renderSettings() {
  const s = state.settings;
  const cats = state.categories;
  const dayOpts = Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}" ${s.cycleDay === i + 1 ? 'selected' : ''}>${i + 1} בחודש</option>`).join('');
  const derived = activeCats().reduce((t, c) => t + (c.budget || 0), 0);
  const fc = focusCat();
  return `<section aria-labelledby="sb-h" class="set-group">
      <div class="sec-head"><h2 class="sec-title" id="sb-h">תקציבים</h2></div>
      <div class="set-row">
        <label for="s-total">תקציב חודשי כולל<span class="hint">${s.monthlyBudget ? 'הסכום שמותר להוציא בחודש' : `ריק = סכום המעטפות (${esc(money(derived, { round: true }))})`}</span></label>
        <input id="s-total" class="field" inputmode="decimal" data-money="monthlyBudget" value="${s.monthlyBudget ? s.monthlyBudget / 100 : ''}" placeholder="${derived / 100 || '—'}">
      </div>
      <p class="block-p">תקציב לכל קטגוריה. השאירו ריק לקטגוריה שרק עוקבים אחריה.</p>
      <div id="cat-edit-list">
        ${cats.filter((c) => !c.archived).map((c) => `<div class="cat-edit" data-cat-row="${c.id}">
          <button type="button" class="swatch" style="background:${c.color}" data-act="cycle-color" data-id="${c.id}" aria-label="החלפת צבע ל${esc(c.name)}"></button>
          <input class="field" value="${esc(c.name)}" data-cat-name="${c.id}" aria-label="שם הקטגוריה" maxlength="30">
          <input class="field money" inputmode="decimal" value="${c.budget ? c.budget / 100 : ''}" placeholder="—" data-cat-budget="${c.id}" aria-label="תקציב חודשי ל${esc(c.name)}">
          <button type="button" class="x" data-act="del-cat" data-id="${c.id}" aria-label="הסרת ${esc(c.name)}">✕</button>
        </div>`).join('')}
      </div>
      <button type="button" class="link" data-act="new-cat">קטגוריה חדשה</button>
      ${cats.some((c) => c.archived) ? `<p class="small muted">בארכיון: ${cats.filter((c) => c.archived).map((c) => `${esc(c.name)} <button type="button" class="link small" data-act="unarchive" data-id="${c.id}">החזרה</button>`).join(' · ')}</p>` : ''}
    </section>

    <section aria-labelledby="sa-h" class="set-group">
      <div class="sec-head"><h2 class="sec-title" id="sa-h">התראות ומחזור</h2></div>
      <div class="set-row"><label for="s-focus">קטגוריה במרכז המסך<span class="hint">מקבלת מקום של כבוד במסך הבית</span></label>
        <select id="s-focus" class="field" data-setting="focusCatId">${activeCats().map((c) => `<option value="${c.id}" ${fc && fc.id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="set-row"><label for="s-alert">להזהיר כשמגיעים ל<span class="hint">אחוז מהתקציב של קטגוריה</span></label>
        <select id="s-alert" class="field" data-setting="alertAt">${[0.6, 0.7, 0.8, 0.9].map((v) => `<option value="${v}" ${s.alertAt === v ? 'selected' : ''}>${v * 100}%</option>`).join('')}</select></div>
      <div class="set-row"><span class="label" id="s-confirm-l">לעצור לפני חריגה<span class="hint">שואל ״בטוח?״ לפני שהוצאה עוברת את התקציב</span></span>
        <span class="switch"><input type="checkbox" id="s-confirm" data-setting="confirmOver" aria-labelledby="s-confirm-l" ${s.confirmOver ? 'checked' : ''}><span></span></span></div>
      <div class="set-row"><label for="s-day">המחזור מתחיל ב<span class="hint">למשל ביום שהמשכורת נכנסת</span></label>
        <select id="s-day" class="field" data-setting="cycleDay">${dayOpts}</select></div>
      <div class="set-row"><label for="s-ci">צ׳ק־אין חודשי ב<span class="hint">הכנסה, עו״ש והשקעות</span></label>
        <select id="s-ci" class="field" data-setting="checkInDay">${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}" ${s.checkInDay === i + 1 ? 'selected' : ''}>${i + 1} בחודש</option>`).join('')}</select></div>
      <div class="reminder-box">
        <p><strong>תזכורת באייפון</strong> — אירוע חוזר ביומן, עם התראה ב־9:00 ביום הצ׳ק־אין${s.cycleDay !== s.checkInDay ? ' וביום שהסיכום החודשי מוכן' : ''}.</p>
        <button type="button" class="btn btn-line btn-small" data-act="reminder">הוספה ליומן</button>
        <p class="small muted">אם לא נפתח חלון של היומן: פותחים את פנקס בספארי ולוחצים שוב. או יוצרים ביומן אירוע ״חוזר כל חודש״ ב־${s.checkInDay} לחודש.</p>
      </div>
      <div class="set-row"><label for="s-wait">זמן המתנה ברשימה<span class="hint">לפני קנייה לא מתוכננת</span></label>
        <select id="s-wait" class="field" data-setting="waitHours">${[24, 48, 72, 168].map((v) => `<option value="${v}" ${s.waitHours === v ? 'selected' : ''}>${v === 168 ? 'שבוע' : v === 24 ? 'יום' : v === 48 ? 'יומיים' : '3 ימים'}</option>`).join('')}</select></div>
    </section>

    <section aria-labelledby="sr-h" class="set-group" id="recurring-section">
      <div class="sec-head"><h2 class="sec-title" id="sr-h">הוצאות קבועות</h2><button type="button" class="link" data-act="new-recurring">להוסיף</button></div>
      ${state.recurring.length ? `<ul class="plain-list" style="margin-bottom:0">${state.recurring.map((r) => `<li><span>${esc(r.name)} <span class="small muted">· ${r.day} בחודש · ${esc(catById(r.catId)?.name || '')}${r.active ? '' : ' · מושהה'}</span></span><span>${m(r.amount)} <button type="button" class="link small" data-act="edit-recurring" data-id="${r.id}" aria-label="עריכת ${esc(r.name)}">עריכה</button></span></li>`).join('')}</ul>` : '<p class="block-p">אין עדיין. שכירות, חשמל, מנויים — נרשמים לבד כל חודש ביום שבחרתם.</p>'}
    </section>

    ${renderSpreadsSettings()}

    ${renderPlacesSettings()}

    <section aria-labelledby="sg-h" class="set-group">
      <div class="sec-head"><h2 class="sec-title" id="sg-h">כללי</h2></div>
      <div class="set-row"><span class="label" id="theme-l">מראה</span>
        <span class="seg" role="radiogroup" aria-labelledby="theme-l">
          ${[['auto', 'כמו בטלפון'], ['light', 'בהיר'], ['dark', 'כהה']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" data-setting="theme" ${s.theme === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </span></div>
      <div class="set-row"><label for="s-income">הכנסה חודשית<span class="hint">לא חובה. לחישוב כמה נשאר</span></label>
        <input id="s-income" class="field" inputmode="decimal" data-money="income" value="${s.income ? s.income / 100 : ''}" placeholder="—"></div>
      <div class="set-row"><label for="s-cur">סימן מטבע</label>
        <input id="s-cur" class="field" data-setting="currency" value="${esc(s.currency)}" maxlength="4"></div>
    </section>

    <section aria-labelledby="sd-h" class="set-group">
      <div class="sec-head"><h2 class="sec-title" id="sd-h">הנתונים שלך</h2></div>
      <p class="block-p">הכול נשמר רק בטלפון הזה — בלי שרת, בלי חשבון, בלי שאף אחד אחר רואה. לכן כדאי לשמור גיבוי פעם בחודש (לקבצים או לאייקלאוד).${s.lastBackupAt ? ` גיבוי אחרון: ${new Date(s.lastBackupAt).toLocaleDateString('he-IL')}.` : ''}</p>
      <div class="data-actions">
        <button type="button" class="btn btn-primary" data-act="backup">שמירת גיבוי</button>
        <button type="button" class="btn btn-line" data-act="restore">שחזור מגיבוי</button>
        <button type="button" class="btn btn-line" data-act="csv">ייצוא לאקסל (CSV)</button>
        <button type="button" class="btn btn-danger-quiet" data-act="wipe">מחיקת כל הנתונים</button>
      </div>
      <input type="file" id="restore-file" accept="application/json,.json" hidden>
    </section>

    <section class="about">
      <p><strong>התקנה באייפון:</strong></p>
      <ol class="install-steps"><li>פותחים את הכתובת בספארי</li><li>כפתור השיתוף (ריבוע עם חץ)</li><li>״הוספה למסך הבית״</li></ol>
      <p style="margin-top:12px">פנקס ${VERSION} · עובד גם בלי אינטרנט</p>
    </section>`;
}

function renderPlacesSettings() {
  const places = L.learnPlaces(state.expenses, state.placePrefs);
  const hidden = Object.entries(state.placePrefs || {}).filter(([, v]) => v.hidden).map(([k]) => k);
  const opts = (sel) => activeCats().map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  return `<section aria-labelledby="sp-h" class="set-group">
    <div class="sec-head"><h2 class="sec-title" id="sp-h">מקומות שזכרתי</h2></div>
    <p class="block-p">אחרי ${L.MIN_PLACE_COUNT} הוצאות עם אותו שם, פנקס זוכר את המקום: מציע אותו בהקלדה ובוחר לבד את הקטגוריה.</p>
    ${places.length ? places.map((p) => `<div class="place-edit">
      <span class="place-name">${esc(p.name)}<span class="hint">${p.count} פעמים · ${esc(money(p.total, { round: true }))}</span></span>
      <label class="sr-only" for="pc-${esc(p.key)}">קטגוריה ל${esc(p.name)}</label>
      <select class="field" id="pc-${esc(p.key)}" data-place-cat="${esc(p.key)}">${opts(p.catId)}</select>
      <button type="button" class="x" data-act="forget-place" data-key="${esc(p.key)}" aria-label="לשכוח את ${esc(p.name)}">✕</button>
    </div>`).join('') : '<p class="small muted">עוד אין מקומות. הם יופיעו כאן לבד.</p>'}
    ${hidden.length ? `<p class="small muted">נשכחו: ${hidden.map((k) => `${esc(k)} <button type="button" class="link small" data-act="unforget-place" data-key="${esc(k)}">החזרה</button>`).join(' · ')}</p>` : ''}
  </section>`;
}

function renderOnboarding() {
  const days = Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}">${i + 1} בחודש</option>`).join('');
  return `<section class="onb">
    <p class="onb-title">פנקס</p>
    <p class="onb-lead">פנקס הוצאות שעוצר אותך רגע לפני שהכסף נגמר. שלוש שאלות ומתחילים.</p>
    <form id="onb-form" novalidate>
      <div class="onb-q">
        <label for="onb-food">כמה מותר לך להוציא על אוכל בחוץ בחודש?</label>
        <span class="hint" id="onb-food-h">מסעדות, משלוחים, קפה. אפשר לשנות אחר כך.</span>
        <div class="money-field"><input id="onb-food" class="field" inputmode="decimal" value="600" aria-describedby="onb-food-h"><span class="cur" aria-hidden="true">${esc(cur())}</span></div>
      </div>
      <div class="onb-q">
        <label for="onb-total">וכמה בסך הכול להוצאות בחודש?</label>
        <span class="hint" id="onb-total-h">לא חובה. מזה נחשב כמה מותר להוציא בכל יום.</span>
        <div class="money-field"><input id="onb-total" class="field" inputmode="decimal" placeholder="למשל 6000" aria-describedby="onb-total-h"><span class="cur" aria-hidden="true">${esc(cur())}</span></div>
      </div>
      <div class="onb-q">
        <label for="onb-day">באיזה יום מתחיל החודש שלך?</label>
        <span class="hint" id="onb-day-h">אם המשכורת נכנסת ב־10, בחרו 10.</span>
        <select id="onb-day" class="field" aria-describedby="onb-day-h">${days}</select>
      </div>
      <p class="form-error" id="onb-error" role="alert"></p>
      <button type="submit" class="btn btn-primary">מתחילים</button>
      <button type="button" class="link" data-act="restore" style="margin-top:8px">יש לי גיבוי לשחזר</button>
      <input type="file" id="restore-file" accept="application/json,.json" hidden>
    </form>
  </section>`;
}

/* ---------- main render ---------- */
function render() {
  const view = $('#view');
  const t = today();
  const cycle = L.cycleFor(t, state.settings.cycleDay);
  applyTheme();

  const onb = !state.onboarded;
  const sub = ui.settings ? 'settings' : ui.report ? 'report' : null;
  $('#tabs').hidden = onb;
  $('#top').hidden = onb;
  $('#btn-back').hidden = !sub;
  $('#btn-settings').hidden = !!sub;
  $('#brand').textContent = sub === 'settings' ? 'הגדרות' : sub === 'report' ? 'סיכום חודשי' : 'פנקס';
  $('#cycle-label').textContent = sub ? '' : `${L.cycleLabel(cycle)} · נשארו ${daysWord(L.dayDiff(t, cycle.end))}`;
  $('#cycle-label').hidden = !!sub;

  $$('#tabs [data-tab]').forEach((b) => {
    if (b.dataset.tab === ui.tab && !sub) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });

  const key = onb ? 'onb' : sub || ui.tab;
  const html = onb ? renderOnboarding()
    : sub === 'settings' ? renderSettings()
    : sub === 'report' ? renderReport()
    : ui.tab === 'ledger' ? renderLedger()
    : ui.tab === 'save' ? renderSave()
    : ui.tab === 'insights' ? renderInsights()
    : renderHome();

  // keep focus/caret in the ledger search while typing
  const active = document.activeElement;
  const keepId = active && view.contains(active) && active.id ? active.id : null;
  const caret = keepId && active.selectionStart != null ? active.selectionStart : null;

  view.innerHTML = html;
  if (ui.lastRenderedTab !== key) {
    view.classList.remove('view-enter');
    void view.offsetWidth;
    view.classList.add('view-enter');
    ui.lastRenderedTab = key;
  } else {
    view.classList.remove('view-enter');
  }
  if (keepId) {
    const el = document.getElementById(keepId);
    if (el) {
      el.focus({ preventScroll: true });
      if (caret != null && el.setSelectionRange) try { el.setSelectionRange(caret, caret); } catch {}
    }
  }
  document.title = onb ? 'פנקס' : sub === 'settings' ? 'הגדרות · פנקס' : sub === 'report' ? 'סיכום חודשי · פנקס' : `${{ home: 'החודש', ledger: 'יומן', save: 'חיסכון', insights: 'תובנות' }[ui.tab]} · פנקס`;
}

function go(tab) {
  ui.tab = tab;
  ui.settings = false;
  ui.report = null;
  render();
  window.scrollTo(0, 0);
  $('#view').focus({ preventScroll: true });
}

/* ---------- theme ---------- */
function applyTheme() {
  const th = state.settings.theme;
  if (th === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = th;
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, { action, onAction, alert = false, ms } = {}) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  $('#toast-msg').textContent = msg;
  el.classList.toggle('is-alert', alert);
  el.setAttribute('role', alert ? 'alert' : 'status');
  const btn = $('#toast-action');
  if (action) {
    btn.hidden = false;
    btn.textContent = action;
    btn.onclick = () => { hideToast(); onAction?.(); };
  } else {
    btn.hidden = true;
    btn.onclick = null;
  }
  el.hidden = false;
  toastTimer = setTimeout(hideToast, ms || (action ? 6000 : alert ? 6500 : 3500));
}
function hideToast() {
  $('#toast').hidden = true;
}

/* ---------- dialogs ---------- */
function openDialog(d) {
  if (!d.open) d.showModal();
}
function closeDialog(d) {
  if (d.open) d.close();
}
for (const d of $$('dialog')) {
  // tap on backdrop closes
  d.addEventListener('click', (ev) => {
    if (ev.target === d) closeDialog(d);
  });
  d.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-close]')) closeDialog(d);
  });
}

/* ---------- add / edit expense ---------- */
const add = {
  str: '', catId: null, editingId: null, catTouched: false, places: [], shown: [],
  kind: 'expense', source: L.INCOME_SOURCES[0], standing: null, standingManual: false,
};

// expense <-> income
function setKind(kind) {
  add.kind = kind;
  const inc = kind === 'income';
  const r = $(`#add-kind input[value="${kind}"]`);
  if (r) r.checked = true;
  $('#add-title').textContent = add.editingId ? (inc ? 'עריכת הכנסה' : 'עריכת הוצאה') : inc ? 'הכנסה חדשה' : 'הוצאה חדשה';
  $('#add-cats-wrap').hidden = inc;
  $('#add-sources-wrap').hidden = !inc;
  $('#add-note').placeholder = inc ? 'פירוט (לא חובה)' : 'איפה? (שופרסל, ארומה…)';
  $('#add-amount').classList.toggle('is-income', inc);
  $('#add-spread').hidden = inc || !!add.editingId;
  // the kind can't change while editing an existing record
  $$('#add-kind input').forEach((i) => { i.disabled = !!add.editingId; });
  updatePlaces();
  updateAddUI();
}

// "Is this a monthly standing order?" for subscription-like expenses
function updateStanding() {
  const box = $('#standing');
  const link = $('#standing-open');
  if (add.kind !== 'expense' || add.editingId) {
    box.hidden = true;
    link.hidden = true;
    return;
  }
  const d = draft();
  const h = L.standingOrderHint(state, d);
  box.classList.toggle('is-info', !!h.existing);
  $('#standing-opts').hidden = !!h.existing;
  if (h.existing) {
    $('#standing-q').textContent = `״${h.existing.name}״ כבר מוגדר כהוראת קבע ונרשם לבד ב־${h.existing.day} בכל חודש.`;
    box.hidden = false;
    link.hidden = true;
    return;
  }
  const show = h.ask || add.standingManual;
  box.hidden = !show;
  link.hidden = show;
  $('#standing-q').textContent = h.reason === 'pattern'
    ? 'זה הופיע גם בחודשים קודמים באותו סכום. הוראת קבע שיורדת כל חודש?'
    : h.reason === 'category' || h.reason === 'keyword'
      ? 'נראה כמו מנוי. זה יורד כל חודש? (הוראת קבע)'
      : 'זה יורד כל חודש? (הוראת קבע)';
  $$('#standing-opts [data-standing]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.standing === add.standing)));
}

function setAddCat(id) {
  add.catId = id;
  const r = $(`#add-cats input[value="${CSS.escape(id)}"]`);
  if (r) r.checked = true;
}

// Suggestions under the "where?" field + automatic category for remembered places
function updatePlaces() {
  if (add.kind === 'income') {
    $('#place-list').hidden = true;
    $('#place-hint').textContent = '';
    return;
  }
  const note = $('#add-note').value;
  const list = L.matchPlaces(add.places.filter((p) => catById(p.catId) && !catById(p.catId).archived), note, 6);
  const exact = L.findPlace(add.places, note);
  add.shown = list;
  const box = $('#place-list');
  box.hidden = !list.length;
  box.innerHTML = list.map((p, i) => `<button type="button" data-place="${i}" aria-pressed="${!!exact && exact.key === p.key}">${esc(p.name)}${p.usual ? ` <span class="num">${esc(money(p.usual))}</span>` : ''}</button>`).join('');
  const hint = $('#place-hint');
  if (exact) {
    if (!add.catTouched && exact.catId !== add.catId) {
      setAddCat(exact.catId);
      updateAddUI();
    }
    hint.textContent = `זוכר את ״${exact.name}״ · ${catById(exact.catId)?.name || ''} · ${exact.count} פעמים`;
  } else {
    const k = L.placeKey(note);
    const seenOnce = k.length >= 2 && state.expenses.some((e) => !e.recurringId && L.placeKey(e.note) === k && e.id !== add.editingId);
    hint.textContent = seenOnce ? 'פעם שנייה כאן — מעכשיו אזכור את המקום.' : '';
  }
}

function pickPlace(p) {
  $('#add-note').value = p.name;
  setAddCat(p.catId);
  add.catTouched = true;
  if (!add.str && p.usual) add.str = String(p.usual / 100);
  updatePlaces();
  updateAddUI();
}

function openAdd({ catId, expense, income, kind } = {}) {
  const t = today();
  const rec = expense || income;
  add.editingId = rec?.id || null;
  add.str = rec ? String(rec.amount / 100) : '';
  add.standing = null;
  add.standingManual = false;
  add.source = income?.source || L.INCOME_SOURCES[0];
  const cats = activeCats();
  const ec = expense && catById(expense.catId);
  add.catId = expense?.catId || catId || (cats.find((c) => c.name === 'אוכל בחוץ') || cats[0])?.id;

  $('#add-note').value = rec?.note || '';
  $('#add-date').value = rec?.date || t;
  $('#add-date').max = L.addDays(t, 366);
  $('#add-delete').hidden = !rec;
  $('#add-delete').textContent = income ? 'מחיקת ההכנסה' : 'מחיקת ההוצאה';
  $('#add-error').textContent = '';
  $('#add-sources').innerHTML = L.INCOME_SOURCES.map((s) => `<label class="cat-chip"><input type="radio" name="source" value="${esc(s)}" ${s === add.source ? 'checked' : ''}><span>${esc(s)}</span></label>`).join('');

  const list = [...cats];
  if (ec && ec.archived) list.push(ec);
  $('#add-cats').innerHTML = list.map((c) => `<label class="cat-chip"><input type="radio" name="cat" value="${c.id}" ${c.id === add.catId ? 'checked' : ''}><span><i class="dot" style="background:${c.color}"></i>${esc(c.name)}</span></label>`).join('');

  add.catTouched = !!expense || !!catId; // an explicit category wins over place memory
  add.places = L.learnPlaces(state.expenses, state.placePrefs);
  setKind(income || kind === 'income' ? 'income' : 'expense');
  openDialog($('#sheet-add'));
  // focus the amount (not the note field) so the iOS keyboard doesn't cover the keypad
  $('#add-amount').focus({ preventScroll: true });
}

function draft() {
  return {
    amount: L.parseAmount(add.str || '0') || 0,
    catId: add.catId,
    note: $('#add-note').value.trim().slice(0, 80),
    date: $('#add-date').value || today(),
  };
}

function updateAddUI() {
  const d = draft();
  const amtEl = $('#add-amount');
  // thousands separators while typing, keeping a trailing "." or typed decimals as-is
  const [whole, frac] = (add.str || '0').split('.');
  amtEl.textContent = `${cur()}${Number(whole || 0).toLocaleString('en-US')}${frac !== undefined ? '.' + frac : ''}`;
  amtEl.classList.toggle('is-empty', !add.str);
  const impactEl = $('#add-impact');
  impactEl.className = 'impact';
  if (add.kind === 'income') {
    impactEl.textContent = '';
    $('#add-submit').textContent = d.amount ? `לרשום הכנסה ${money(d.amount)}` : 'לרשום הכנסה';
    updateStanding();
    return;
  }
  updateStanding();
  const c = catById(d.catId);
  const imp = L.impactOf(state, { ...d, amount: d.amount || 1, excludeId: add.editingId }, today());
  if (!c) {
    impactEl.textContent = '';
  } else if (!imp) {
    impactEl.textContent = c.budget ? '' : `ל${c.name} אין תקציב — רק מעקב.`;
  } else if (!d.amount) {
    const left = imp.budget - imp.before;
    impactEl.innerHTML = left >= 0 ? `נשארו ${m(left)} ל${esc(c.name)} במחזור הזה` : `${esc(c.name)}: כבר בחריגה של ${m(-left)}`;
    if (left < 0) impactEl.classList.add('is-over');
  } else if (imp.willBeOver) {
    impactEl.innerHTML = imp.wasOver ? `${esc(c.name)} כבר בחריגה. אחרי זה: ${m(imp.overBy)} מעל התקציב` : `זה יעבור את תקציב ${esc(c.name)} ב־${m(imp.overBy)}`;
    impactEl.classList.add('is-over');
  } else {
    const warn = imp.after >= imp.budget * (state.settings.alertAt ?? 0.8);
    impactEl.innerHTML = `אחרי זה נשארו ${m(imp.leftAfter)} ל${esc(c.name)}${imp.currentCycle && imp.daysLeft ? ` · ${m(imp.perDayAfter, { round: true })} ליום` : ''}`;
    if (warn) impactEl.classList.add('is-warn');
  }
  $('#add-submit').textContent = d.amount ? `לרשום ${money(d.amount)}` : 'לרשום';
}

function pressKey(k) {
  add.str = L.keypadInput(add.str, k);
  $('#add-error').textContent = '';
  updateAddUI();
}

$('#keypad').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-key]');
  if (b) pressKey(b.dataset.key);
});
$('#add-cats').addEventListener('change', (ev) => {
  if (ev.target.name === 'cat') {
    add.catId = ev.target.value;
    add.catTouched = true;
    updateAddUI();
  }
});
$('#place-list').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-place]');
  if (b) pickPlace(add.shown[Number(b.dataset.place)]);
});
$('#add-note').addEventListener('input', () => { updatePlaces(); updateStanding(); });
$('#add-kind').addEventListener('change', (ev) => {
  if (ev.target.name === 'kind') setKind(ev.target.value);
});
$('#add-sources').addEventListener('change', (ev) => {
  if (ev.target.name === 'source') add.source = ev.target.value;
});
$('#standing-opts').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-standing]');
  if (!b) return;
  add.standing = add.standing === b.dataset.standing ? null : b.dataset.standing;
  updateStanding();
});
$('#standing-open').addEventListener('click', () => {
  add.standingManual = true;
  add.standing = 'yes';
  updateStanding();
  $('#standing-opts [data-standing="yes"]').focus();
});
$('#add-date').addEventListener('change', updateAddUI);
$('#sheet-add').addEventListener('keydown', (ev) => {
  // physical keyboard support when the note field isn't focused
  if (ev.target.matches('input')) return;
  if (/^\d$/.test(ev.key) || ev.key === '.') { pressKey(ev.key); ev.preventDefault(); }
  else if (ev.key === 'Backspace') { pressKey('back'); ev.preventDefault(); }
  else if (ev.key === 'Enter' && !ev.target.matches('button')) { submitAdd(); ev.preventDefault(); }
});
$('#add-note').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); }
});
$('#add-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  submitAdd();
});

function submitAdd() {
  const d = draft();
  if (!d.amount) {
    $('#add-error').textContent = 'חסר סכום. הקלידו אותו במקשים.';
    const a = $('#add-amount');
    a.classList.remove('shake');
    void a.offsetWidth;
    a.classList.add('shake');
    return;
  }
  if (add.kind === 'income') {
    saveIncome(d);
    return;
  }
  if (!catById(d.catId)) {
    $('#add-error').textContent = 'בחרו קטגוריה.';
    return;
  }
  const t = today();
  const imp = L.impactOf(state, { ...d, excludeId: add.editingId }, t);
  const original = add.editingId && state.expenses.find((e) => e.id === add.editingId);
  const growing = !original || d.amount > original.amount || d.catId !== original.catId;
  if (imp && imp.willBeOver && imp.currentCycle && state.settings.confirmOver && growing) {
    openOverCheck(d, imp);
    return;
  }
  saveExpense(d, imp);
}

function saveExpense(d, imp) {
  const t = today();
  // is this the expense that makes a place "remembered"?
  const pk = L.placeKey(d.note);
  const learned = !add.editingId && pk.length >= 2 && !state.placePrefs?.[pk]?.hidden
    && state.expenses.filter((e) => !e.recurringId && L.placeKey(e.note) === pk).length === L.MIN_PLACE_COUNT - 1;
  // standing order: the answer only counts while the question is on screen
  const standing = !add.editingId && add.standing === 'yes' && !$('#standing').hidden && !$('#standing-opts').hidden;
  let rec = null;
  if (add.editingId) {
    const i = state.expenses.findIndex((e) => e.id === add.editingId);
    if (i >= 0) state.expenses[i] = { ...state.expenses[i], ...d };
  } else {
    const entry = { id: L.uid(), ...d, createdAt: Date.now() };
    if (standing) {
      rec = L.recurringFromExpense(d);
      state.recurring.push(rec);
      entry.recurringId = rec.id;
    }
    state.expenses.push(entry);
    requestPersistence();
  }
  const wasEdit = !!add.editingId;
  const savedId = wasEdit ? add.editingId : state.expenses[state.expenses.length - 1].id;
  if (rec) state = L.applyRecurring(state, t).state; // recorded late? fill in the months since
  closeDialog($('#sheet-add'));
  closeDialog($('#sheet-over'));
  commit();

  const c = catById(d.catId);
  if (rec) {
    toast(`נרשם ${money(d.amount)}. מעכשיו ״${rec.name}״ יירשם לבד ב־${rec.day} בכל חודש.`, {
      action: 'ביטול',
      onAction: () => {
        state.expenses = state.expenses.filter((e) => e.recurringId !== rec.id);
        state.recurring = state.recurring.filter((r) => r.id !== rec.id);
        commit();
        toast('בוטל, כולל הוראת הקבע');
      },
    });
  } else if (imp && imp.willBeOver && imp.currentCycle) {
    toast(`נרשם. ${c.name}: ${money(imp.overBy)} מעל התקציב החודש.`, { alert: true });
  } else if (imp && imp.crossesWarn && imp.currentCycle) {
    toast(`שימו לב: נשארו ${money(imp.leftAfter)} ל${c.name}${imp.daysLeft ? ` — ${money(imp.perDayAfter, { round: true })} ליום עד סוף המחזור` : ''}.`, { alert: true });
  } else if (!wasEdit) {
    toast(`נרשם ${money(d.amount)} · ${c.name}${learned ? `. זכרתי את ״${d.note}״ — בפעם הבאה הקטגוריה תיבחר לבד.` : ''}`, {
      action: 'ביטול',
      onAction: () => {
        state.expenses = state.expenses.filter((e) => e.id !== savedId);
        commit();
        toast('ההוצאה בוטלה');
      },
    });
  } else {
    toast('השינוי נשמר');
  }
  void t;
}

$('#add-spread').addEventListener('click', () => {
  const d = draft();
  closeDialog($('#sheet-add'));
  openSpread(null, { total: d.amount, name: d.note, catId: d.catId, start: d.date });
});

function saveIncome(d) {
  const data = { amount: d.amount, date: d.date, note: d.note, source: add.source };
  let savedId = add.editingId;
  if (add.editingId) {
    const i = state.incomes.findIndex((x) => x.id === add.editingId);
    if (i >= 0) state.incomes[i] = { ...state.incomes[i], ...data };
  } else {
    savedId = L.uid();
    state.incomes.push({ id: savedId, ...data, createdAt: Date.now() });
  }
  const wasEdit = !!add.editingId;
  closeDialog($('#sheet-add'));
  commit();
  if (wasEdit) return toast('השינוי נשמר');
  toast(`נרשמה הכנסה ${money(d.amount)} · ${add.source}`, {
    action: 'ביטול',
    onAction: () => {
      state.incomes = state.incomes.filter((x) => x.id !== savedId);
      commit();
    },
  });
}

$('#add-delete').addEventListener('click', () => {
  const id = add.editingId;
  if (add.kind === 'income') {
    const ii = state.incomes.findIndex((x) => x.id === id);
    if (ii < 0) return;
    const [gone] = state.incomes.splice(ii, 1);
    closeDialog($('#sheet-add'));
    commit();
    toast('ההכנסה נמחקה', { action: 'ביטול', onAction: () => { state.incomes.push(gone); commit(); } });
    return;
  }
  const idx = state.expenses.findIndex((e) => e.id === id);
  if (idx < 0) return;
  const [removed] = state.expenses.splice(idx, 1);
  closeDialog($('#sheet-add'));
  commit();
  toast('ההוצאה נמחקה', {
    action: 'ביטול',
    onAction: () => {
      state.expenses.push(removed);
      commit();
    },
  });
});

/* ---------- over-budget check ---------- */
let overDraft = null;
function openOverCheck(d, imp) {
  overDraft = { d, imp };
  const c = imp.cat;
  $('#over-title').textContent = imp.wasOver ? `${c.name} כבר מעל התקציב` : `זה יוציא אותך מתקציב ${c.name}`;
  $('#over-text').innerHTML = imp.wasOver
    ? `התקציב החודשי הוא ${m(imp.budget)} וכבר הוצאת ${m(imp.before)}. עם ההוצאה הזו: <strong>${m(imp.overBy)} מעל</strong>.`
    : `התקציב החודשי הוא ${m(imp.budget)} ונשארו בו ${m(imp.budget - imp.before)}. ההוצאה הזו (${m(d.amount)}) תעבור אותו ב־<strong>${m(imp.overBy)}</strong>${imp.daysLeft > 1 ? `, ועוד ${daysWord(imp.daysLeft - 1)} עד סוף המחזור` : ''}.`;
  $('#over-skip').textContent = add.editingId ? 'לא לשנות' : `ויתרתי — ${money(d.amount)} נשארים אצלי`;
  openDialog($('#sheet-over'));
  $('#over-skip').focus();
}
$('#over-anyway').addEventListener('click', () => {
  if (overDraft) saveExpense(overDraft.d, overDraft.imp);
  overDraft = null;
});
$('#over-skip').addEventListener('click', () => {
  if (!overDraft) return;
  const { d } = overDraft;
  closeDialog($('#sheet-over'));
  closeDialog($('#sheet-add'));
  if (!add.editingId) {
    const name = d.note || catById(d.catId)?.name || '';
    state.resisted.push({ id: L.uid(), name, amount: d.amount, date: today(), goalId: null, catId: d.catId });
    commit();
    toast(`יפה. ${money(d.amount)} נשארו אצלך — נרשם בחיסכון.`, {
      action: 'ביטול',
      onAction: () => {
        state.resisted.pop();
        commit();
      },
    });
  }
  overDraft = null;
});

/* ---------- generic form sheet ---------- */
let formSubmit = null;
function openForm({ title, intro = '', fields, submit, onSubmit, extra = [] }) {
  $('#form-title').textContent = title;
  $('#form-intro').textContent = intro;
  $('#form-intro').hidden = !intro;
  $('#form-error').textContent = '';
  $('#form-fields').innerHTML = fields.map((f) => {
    const id = `f-${f.name}`;
    const hint = f.hint ? `<span class="hint" id="${id}-h">${esc(f.hint)}</span>` : '';
    const desc = f.hint ? `aria-describedby="${id}-h"` : '';
    if (f.type === 'check') {
      return `<label class="form-check"><input type="checkbox" id="${id}" name="${f.name}" ${f.value ? 'checked' : ''}> ${esc(f.label)}</label>`;
    }
    if (f.type === 'select') {
      return `<div class="form-field"><label for="${id}">${esc(f.label)}</label><select class="field" id="${id}" name="${f.name}" ${desc}>${f.options.map(([v, l]) => `<option value="${esc(v)}" ${String(f.value) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>${hint}</div>`;
    }
    if (f.type === 'money') {
      return `<div class="form-field"><label for="${id}">${esc(f.label)}</label><div class="money-field"><input class="field" id="${id}" name="${f.name}" inputmode="decimal" autocomplete="off" value="${f.value ? f.value / 100 : ''}" placeholder="${esc(f.placeholder || '')}" ${desc}><span class="cur" aria-hidden="true">${esc(cur())}</span></div>${hint}</div>`;
    }
    return `<div class="form-field"><label for="${id}">${esc(f.label)}</label><input class="field" id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" maxlength="${f.max || 60}" placeholder="${esc(f.placeholder || '')}" autocomplete="off" ${desc}>${hint}</div>`;
  }).join('');
  $('#form-actions').innerHTML = `<button type="submit" class="btn btn-primary">${esc(submit)}</button>` + extra.map((x, i) => `<button type="button" class="btn ${x.danger ? 'btn-danger-quiet' : 'btn-line'}" data-extra="${i}">${esc(x.label)}</button>`).join('');
  $('#form-actions').onclick = (ev) => {
    const b = ev.target.closest('[data-extra]');
    if (!b) return;
    const x = extra[Number(b.dataset.extra)];
    if (x.run() !== false) closeDialog($('#sheet-form'));
  };
  formSubmit = () => {
    const vals = {};
    $$('#form-fields [aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    for (const f of fields) {
      const el = $(`#f-${f.name}`);
      const name = `״${f.label.replace(/[?:]$/, '')}״`;
      if (f.type === 'check') vals[f.name] = el.checked;
      else if (f.type === 'money') {
        const raw = el.value.trim();
        const a = raw ? L.parseAmount(raw) : 0;
        if (a === null) return fail(`${name} צריך להיות מספר, למשל 45 או 12.50`, el);
        if (f.required && !a) return fail(`חסר סכום ב${name}`, el);
        vals[f.name] = a;
      } else {
        vals[f.name] = el.value.trim();
        if (f.required && !vals[f.name]) return fail(`צריך למלא את ${name}`, el);
      }
    }
    const r = onSubmit(vals);
    if (typeof r === 'string') return fail(r);
    closeDialog($('#sheet-form'));
  };
  openDialog($('#sheet-form'));
  const first = $('#form-fields input, #form-fields select');
  first?.focus();
}
function fail(msg, el) {
  $('#form-error').textContent = msg;
  if (el) {
    el.setAttribute('aria-invalid', 'true');
    el.setAttribute('aria-errormessage', 'form-error');
    el.focus();
  }
  return false;
}
$('#form-generic').addEventListener('submit', (ev) => {
  ev.preventDefault();
  formSubmit?.();
});

const catOptions = () => activeCats().map((c) => [c.id, c.name]);

function openResist(catId) {
  const goals = state.goals.filter((g) => g.saved < g.target);
  openForm({
    title: 'ויתרתי על…',
    submit: 'לרשום ויתור',
    fields: [
      { name: 'name', label: 'על מה ויתרת?', placeholder: 'משלוח סושי', required: true },
      { name: 'amount', label: 'כמה זה היה עולה?', type: 'money', required: true },
      ...(goals.length ? [{ name: 'goal', label: 'להעביר למטרה', type: 'select', value: goals[0].id, options: [['', 'לא, רק לרשום'], ...goals.map((g) => [g.id, g.name])] }] : []),
    ],
    onSubmit: (v) => {
      state.resisted.push({ id: L.uid(), name: v.name, amount: v.amount, date: today(), goalId: v.goal || null, catId: catId || null });
      const g = v.goal && state.goals.find((x) => x.id === v.goal);
      if (g) g.saved += v.amount;
      commit();
      toast(g ? `${money(v.amount)} נוספו ל${g.name}` : `${money(v.amount)} נשארו אצלך`);
    },
  });
}

function openGoal(goal) {
  openForm({
    title: goal ? 'עריכת מטרה' : 'מטרה חדשה',
    submit: goal ? 'שמירה' : 'ליצור מטרה',
    fields: [
      { name: 'name', label: 'שם המטרה', value: goal?.name, placeholder: 'טיסה ליוון', required: true },
      { name: 'target', label: 'כמה צריך?', type: 'money', value: goal?.target, required: true },
      { name: 'saved', label: 'כמה כבר יש?', type: 'money', value: goal?.saved },
    ],
    extra: goal ? [{ label: 'מחיקת המטרה', danger: true, run: () => { const i = state.goals.indexOf(goal); state.goals.splice(i, 1); commit(); toast('המטרה נמחקה', { action: 'ביטול', onAction: () => { state.goals.splice(i, 0, goal); commit(); } }); } }] : [],
    onSubmit: (v) => {
      if (goal) Object.assign(goal, { name: v.name, target: v.target, saved: v.saved });
      else state.goals.push({ id: L.uid(), name: v.name, target: v.target, saved: v.saved || 0, createdAt: Date.now() });
      commit();
    },
  });
}

function openDeposit(goal) {
  openForm({
    title: `הפקדה ל${goal.name}`,
    submit: 'להפקיד',
    fields: [{ name: 'amount', label: 'סכום', type: 'money', required: true, hint: `חסרים ${money(Math.max(0, goal.target - goal.saved))}` }],
    onSubmit: (v) => {
      goal.saved += v.amount;
      commit();
      toast(goal.saved >= goal.target ? `הגעת ליעד של ${goal.name}!` : `${money(v.amount)} נוספו. חסרים ${money(goal.target - goal.saved)}`);
    },
  });
}

function openWish() {
  openForm({
    title: 'לרשימת ההמתנה',
    submit: `להמתין ${state.settings.waitHours === 168 ? 'שבוע' : `${state.settings.waitHours} שעות`}`,
    fields: [
      { name: 'name', label: 'מה רוצים לקנות?', placeholder: 'אוזניות חדשות', required: true },
      { name: 'amount', label: 'מחיר', type: 'money', required: true },
      { name: 'cat', label: 'קטגוריה (אם תקנו)', type: 'select', value: activeCats().find((c) => c.name === 'קניות')?.id || activeCats()[0]?.id, options: catOptions() },
    ],
    onSubmit: (v) => {
      state.wishlist.push({ id: L.uid(), name: v.name, amount: v.amount, catId: v.cat, addedAt: Date.now(), waitHours: state.settings.waitHours, status: 'waiting' });
      commit();
      toast('נכנס לרשימה. נחזור לזה אחר כך.');
    },
  });
}

function openRecurring(item) {
  const t = today();
  const dayOpts = Array.from({ length: 31 }, (_, i) => [i + 1, `${i + 1} בחודש`]);
  openForm({
    title: item ? 'עריכת הוצאה קבועה' : 'הוצאה קבועה חדשה',
    submit: item ? 'שמירה' : 'להוסיף',
    fields: [
      { name: 'name', label: 'שם', value: item?.name, placeholder: 'נטפליקס', required: true },
      { name: 'amount', label: 'סכום חודשי', type: 'money', value: item?.amount, required: true },
      { name: 'cat', label: 'קטגוריה', type: 'select', value: item?.catId || activeCats().find((c) => c.name === 'מנויים')?.id || activeCats()[0]?.id, options: catOptions() },
      { name: 'day', label: 'יום החיוב', type: 'select', value: item?.day || Number(t.slice(8, 10)), options: dayOpts, hint: 'בחודשים קצרים יירשם ביום האחרון' },
      ...(item ? [{ name: 'active', label: 'פעילה', type: 'check', value: item.active }] : [{ name: 'thisMonth', label: 'כבר חויב החודש — לרשום גם עכשיו', type: 'check', value: true }]),
    ],
    extra: item ? [{ label: 'מחיקה', danger: true, run: () => { state.recurring = state.recurring.filter((r) => r !== item); commit(); toast('ההוצאה הקבועה נמחקה. רישומים קודמים נשארו ביומן.'); } }] : [],
    onSubmit: (v) => {
      const day = Number(v.day);
      if (item) {
        Object.assign(item, { name: v.name, amount: v.amount, catId: v.cat, day, active: v.active });
      } else {
        const thisMonth = L.monthKey(t);
        const dueThisMonth = L.clampDay(thisMonth, day) <= t;
        // if the charge date already passed: either log it now, or start from next month
        const startMonth = dueThisMonth && !v.thisMonth ? L.nextMonthKey(thisMonth) : thisMonth;
        state.recurring.push({ id: L.uid(), name: v.name, amount: v.amount, catId: v.cat, day, startMonth, lastMonth: null, active: true });
      }
      const r = L.applyRecurring(state, t);
      state = r.state;
      commit();
      toast(r.added.length ? `נוסף ונרשם ${r.added.length === 1 ? 'החיוב של החודש' : `${r.added.length} חיובים`}` : 'נשמר');
    },
  });
}

/* ---------- insurance & annual expenses, spread evenly ---------- */
const NEW_INS_CAT = '__new_ins';
function fullDate(iso) {
  const d = L.fromISO(iso);
  return `${d.getDate()} ב${L.MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
function insuranceCatId() {
  return activeCats().find((c) => c.name === 'ביטוחים')?.id || null;
}

function openSpread(item, prefill = {}) {
  const t = today();
  const src = item || prefill;
  const insId = insuranceCatId();
  const catOpts = [...catOptions(), ...(insId ? [] : [[NEW_INS_CAT, 'ביטוחים (קטגוריה חדשה)']])];
  const defaultCat = item?.catId || (prefill.catId && prefill.catId !== activeCats().find((c) => c.name === 'אוכל בחוץ')?.id ? prefill.catId : null) || insId || NEW_INS_CAT;
  const info = item ? L.spreadInfo(item, t) : null;
  openForm({
    title: item ? item.name : 'ביטוח או הוצאה שנתית',
    intro: item
      ? `${money(info.monthly)} בחודש · ${Math.min(info.passed, item.months)} מתוך ${item.months} חודשים עברו · ${info.active ? `מסתיים ב־${fullDate(info.end)}` : 'הסתיים'}.`
      : 'משלמים פעם אחת (או בתשלומים) על משהו שמכסה תקופה ארוכה? פנקס מחלק את הסכום שווה בשווה בין החודשים, כך שאף חודש לא ״נפגע״ לבד.',
    submit: item ? 'שמירה' : 'לפרוס',
    fields: [
      { name: 'name', label: 'מה זה?', value: src.name || '', placeholder: 'ביטוח רכב', required: true, max: 40 },
      { name: 'total', label: 'הסכום הכולל', type: 'money', value: src.total, required: true, hint: 'כל התקופה ביחד, למשל הפרמיה השנתית' },
      { name: 'months', label: 'לפרוס על', type: 'select', value: src.months || 12, options: [[12, 'שנה (12 חודשים)'], [6, 'חצי שנה (6)'], [3, 'רבעון (3)'], [24, 'שנתיים (24)']] },
      { name: 'start', label: 'מתי מתחיל? (תאריך התשלום או תחילת הפוליסה)', type: 'date', value: src.start || t },
      { name: 'cat', label: 'קטגוריה', type: 'select', value: defaultCat, options: catOpts },
    ],
    extra: item
      ? [
          { label: 'חידוש לתקופה נוספת', run: () => { setTimeout(() => openSpread(null, { name: item.name, total: item.total, months: item.months, catId: item.catId, start: info.end }), 50); } },
          { label: 'מחיקה', danger: true, run: () => removeSpread(item) },
        ]
      : [],
    onSubmit: (v) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.start)) return 'צריך תאריך התחלה.';
      let catId = v.cat;
      if (catId === NEW_INS_CAT) {
        catId = L.uid();
        state.categories.push({ id: catId, name: 'ביטוחים', budget: 0, color: S.PALETTE[2], archived: false });
      }
      const data = { name: v.name, total: v.total, months: Number(v.months), start: v.start, catId };
      if (item) Object.assign(item, data);
      else state.spreads.push({ id: L.uid(), createdAt: Date.now(), ...data });
      state = L.syncSpreads(state);
      commit();
      toast(`${v.name}: ${money(Math.round(v.total / Number(v.months)))} בחודש, למשך ${Number(v.months)} חודשים`);
    },
  });
}

function removeSpread(item) {
  const i = state.spreads.indexOf(item);
  state.spreads.splice(i, 1);
  state = L.syncSpreads(state);
  commit();
  toast(`${item.name} נמחק`, {
    action: 'ביטול',
    onAction: () => {
      state.spreads.splice(i, 0, item);
      state = L.syncSpreads(state);
      commit();
    },
  });
}

// Policies ending within 30 days that haven't been renewed yet
function renewalsDue(t) {
  return state.spreads.filter((s) => {
    const info = L.spreadInfo(s, t);
    return info.renewSoon && !state.spreads.some((o) => o !== s && o.name === s.name && o.start > s.start);
  });
}

function renderSpreadsSettings() {
  const t = today();
  const list = [...state.spreads].sort((a, b) => (a.start < b.start ? 1 : -1));
  return `<section aria-labelledby="ss-h" class="set-group" id="spreads-section">
    <div class="sec-head"><h2 class="sec-title" id="ss-h">ביטוחים והוצאות שנתיות</h2><button type="button" class="link" data-act="new-spread">להוסיף</button></div>
    ${list.length ? `<ul class="plain-list" style="margin-bottom:0">${list.map((s) => {
      const info = L.spreadInfo(s, t);
      return `<li><span>${esc(s.name)} <span class="small muted">· ${esc(money(s.total, { round: true }))} ל־${s.months} חודשים · ${info.active ? `${Math.min(info.passed, s.months)}/${s.months}` : 'הסתיים'}</span></span><span>${m(info.monthly)}<span class="small muted"> לחודש</span> <button type="button" class="link small" data-act="edit-spread" data-id="${s.id}" aria-label="עריכת ${esc(s.name)}">עריכה</button></span></li>`;
    }).join('')}</ul>` : '<p class="block-p">ביטוח רכב, ביטוח דירה, אגרת רישוי, מנוי שנתי — סכום אחד שמתחלק שווה בשווה על כל החודשים.</p>'}
  </section>`;
}

/* ---------- monthly check-in ---------- */
function openCheckIn(period = L.checkInStatus(state, today()).period) {
  const day = String(state.settings.checkInDay).padStart(2, '0');
  const existing = state.snapshots.find((s) => s.period === period);
  const prevSnap = state.snapshots.filter((s) => s.period < period).sort((a, b) => (a.period < b.period ? -1 : 1)).pop();
  const was = (k) => (prevSnap && prevSnap[k] ? `בפעם הקודמת: ${money(prevSnap[k], { round: true })}` : '');
  // incomes already logged in the cycle of this check-in
  const logged = L.sumBy(L.incomesInCycle(state, L.cycleFor(`${period}-${day}`, state.settings.cycleDay)));
  openForm({
    title: `צ׳ק־אין · ${L.monthLabelFromKey(period)}`,
    intro: 'שלושה מספרים, פעם בחודש. מהם פנקס מחשב הוצאות מול הכנסות ואת השווי שלך לאורך זמן.',
    submit: existing ? 'שמירה' : 'לשמור את החודש',
    fields: [
      { name: 'income', label: 'כמה כסף נכנס החודש?', type: 'money', required: true, value: existing?.income ?? (logged || prevSnap?.income || state.settings.income || 0), hint: logged ? `רשמת ${money(logged, { round: true })} כהכנסות במחזור הזה` : 'משכורת וכל הכנסה אחרת, נטו' },
      { name: 'cash', label: 'כמה יש בעו״ש ובמזומן?', type: 'money', value: existing?.cash, hint: was('cash') || 'היתרה בבנק, כולל מזומן' },
      { name: 'investments', label: 'כמה שוות ההשקעות?', type: 'money', value: existing?.investments, hint: was('investments') || 'תיק מניות, קרן השתלמות, גמל להשקעה' },
      { name: 'savings', label: 'וכמה בחיסכון?', type: 'money', value: existing?.savings, hint: was('savings') || 'פיקדונות וקופות חיסכון. לא חובה' },
    ],
    extra: [
      ...(existing ? [{ label: 'מחיקת הצ׳ק־אין', danger: true, run: () => { state.snapshots = state.snapshots.filter((s) => s !== existing); commit(); toast('הצ׳ק־אין נמחק'); } }] : []),
      { label: 'תזכורת קבועה ביומן', run: () => { addReminder(); return false; } },
    ],
    onSubmit: (v) => {
      const snap = { id: existing?.id || L.uid(), period, date: existing?.date || `${period}-${day}`, income: v.income, cash: v.cash, investments: v.investments, savings: v.savings, savedAt: Date.now() };
      state.snapshots = [...state.snapshots.filter((s) => s.period !== period), snap];
      const latest = state.snapshots.reduce((a, b) => (b.period > a.period ? b : a));
      if (latest.period === period) state.settings.income = v.income;
      state.settings.checkInPrompted = period;
      commit();
      const nw = L.netWorth(snap);
      const change = prevSnap ? nw - L.netWorth(prevSnap) : null;
      toast(change === null ? `נשמר. השווי שלך: ${money(nw, { round: true })}` : `השווי שלך: ${money(nw, { round: true })} (${money(change, { round: true, signed: true })} מהחודש הקודם)`);
    },
  });
}

function maybePromptCheckIn() {
  if (!state.onboarded) return;
  const ci = L.checkInStatus(state, today());
  if (!ci.due || state.settings.checkInPrompted === ci.period) return;
  if ($$('dialog').some((d) => d.open)) return;
  state.settings.checkInPrompted = ci.period;
  persist();
  setTimeout(() => openCheckIn(ci.period), 450);
}

/* ---------- calendar reminder ---------- */
async function addReminder() {
  const ics = L.reminderICS({ checkInDay: state.settings.checkInDay, cycleDay: state.settings.cycleDay, url: location.origin + location.pathname });
  const url = new URL('reminder.ics', location.href).href;
  // Served through the service worker as a real text/calendar file, so iOS shows "Add to Calendar".
  if ('caches' in window && navigator.serviceWorker?.controller) {
    try {
      const c = await caches.open('pinkas-gen');
      await c.put(url, new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } }));
      if (isStandalone()) location.href = url;
      else if (!window.open(url, '_blank')) location.href = url;
      return;
    } catch (err) {
      console.warn('reminder via cache failed', err);
    }
  }
  await shareOrDownload('pinkas-reminder.ics', ics, 'text/calendar');
}

function openCategory() {
  openForm({
    title: 'קטגוריה חדשה',
    submit: 'להוסיף',
    fields: [
      { name: 'name', label: 'שם', placeholder: 'ילדים', required: true, max: 30 },
      { name: 'budget', label: 'תקציב חודשי', type: 'money', hint: 'לא חובה' },
    ],
    onSubmit: (v) => {
      if (state.categories.some((c) => !c.archived && c.name === v.name)) return 'כבר יש קטגוריה בשם הזה.';
      state.categories.push({ id: L.uid(), name: v.name, budget: v.budget, color: S.PALETTE[state.categories.length % S.PALETTE.length], archived: false });
      commit();
    },
  });
}

/* ---------- backup ---------- */
async function shareOrDownload(filename, text, type) {
  const blob = new Blob([text], { type });
  const file = new File([blob], filename, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

async function backup() {
  const ok = await shareOrDownload(`pinkas-${today()}.json`, S.exportJSON(state), 'application/json');
  if (ok) {
    state.settings.lastBackupAt = Date.now();
    commit();
    toast('הגיבוי נשמר');
  }
}

function restorePick() {
  const input = $('#restore-file');
  input.value = '';
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    try {
      const next = S.importJSON(await f.text());
      if (state.expenses.length && !confirm(`לשחזר מהגיבוי? ${next.expenses.length} הוצאות יחליפו את ${state.expenses.length} שבטלפון עכשיו.`)) return;
      next.onboarded = true;
      state = L.applyRecurring(next, today()).state;
      ui.settings = false;
      ui.tab = 'home';
      commit();
      toast(`שוחזרו ${state.expenses.length} הוצאות`);
    } catch (err) {
      toast(err.message || 'לא הצלחנו לקרוא את הקובץ.', { alert: true });
    }
  };
  input.click();
}

/* ---------- actions (event delegation) ---------- */
const actions = {
  add: (el) => openAdd({ catId: el.dataset.cat, kind: el.dataset.kind }),
  'edit-income': (el) => {
    const i = state.incomes.find((x) => x.id === el.dataset.id);
    if (i) openAdd({ income: i });
  },
  'ledger-day': (el) => {
    ui.ledgerDay = ui.ledgerDay === el.dataset.date ? null : el.dataset.date;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    $(`[data-act="ledger-day"][data-date="${el.dataset.date}"]`)?.focus({ preventScroll: true });
  },
  'ledger-all-days': () => { ui.ledgerDay = null; render(); },
  edit: (el) => {
    const e = state.expenses.find((x) => x.id === el.dataset.id);
    if (!e) return;
    // a share of a spread expense is edited through its item, so all shares stay equal
    const sp = e.spreadId && state.spreads.find((s) => s.id === e.spreadId);
    if (sp) openSpread(sp);
    else openAdd({ expense: e });
  },
  'new-spread': () => openSpread(),
  'edit-spread': (el) => openSpread(state.spreads.find((s) => s.id === el.dataset.id)),
  tab: (el) => go(el.dataset.tab),
  settings: () => openSettings(),
  'settings-recurring': () => {
    openSettings();
    $('#recurring-section')?.scrollIntoView({ block: 'start' });
  },
  'settings-spreads': () => {
    openSettings();
    $('#spreads-section')?.scrollIntoView({ block: 'start' });
  },
  'ledger-cat': (el) => {
    ui.ledgerCat = el.dataset.cat;
    ui.ledgerOffset = 0;
    ui.ledgerQuery = '';
    go('ledger');
  },
  'ledger-prev': () => { ui.ledgerOffset--; ui.ledgerDay = null; render(); },
  'ledger-next': () => { if (ui.ledgerOffset < 0) ui.ledgerOffset++; ui.ledgerDay = null; render(); },
  'clear-filter': () => { ui.ledgerQuery = ''; ui.ledgerCat = ''; ui.ledgerDay = null; render(); },
  resist: (el) => openResist(el.dataset.cat),
  'del-resist': (el) => {
    const i = state.resisted.findIndex((r) => r.id === el.dataset.id);
    if (i < 0) return;
    const [r] = state.resisted.splice(i, 1);
    const g = r.goalId && state.goals.find((x) => x.id === r.goalId);
    if (g) g.saved = Math.max(0, g.saved - r.amount);
    commit();
    toast('נמחק', { action: 'ביטול', onAction: () => { state.resisted.splice(i, 0, r); if (g) g.saved += r.amount; commit(); } });
  },
  'new-goal': () => openGoal(),
  'edit-goal': (el) => openGoal(state.goals.find((g) => g.id === el.dataset.id)),
  deposit: (el) => openDeposit(state.goals.find((g) => g.id === el.dataset.id)),
  'new-wish': () => openWish(),
  'wish-skip': (el) => {
    const w = state.wishlist.find((x) => x.id === el.dataset.id);
    w.status = 'skipped';
    state.resisted.push({ id: L.uid(), name: w.name, amount: w.amount, date: today(), goalId: null, catId: w.catId });
    commit();
    toast(`${money(w.amount)} נשארו אצלך. כל הכבוד.`);
  },
  'wish-buy': (el) => {
    const w = state.wishlist.find((x) => x.id === el.dataset.id);
    w.status = 'bought';
    persist();
    openAdd({ catId: w.catId || undefined });
    add.str = String(w.amount / 100);
    $('#add-note').value = w.name;
    updateAddUI();
    render();
  },
  'wish-del': (el) => {
    state.wishlist = state.wishlist.filter((x) => x.id !== el.dataset.id);
    commit();
  },
  'new-recurring': () => openRecurring(),
  'edit-recurring': (el) => openRecurring(state.recurring.find((r) => r.id === el.dataset.id)),
  'new-cat': () => openCategory(),
  'del-cat': (el) => {
    const c = catById(el.dataset.id);
    if (activeCats().length <= 1) return toast('צריך לפחות קטגוריה אחת.');
    const used = state.expenses.some((e) => e.catId === c.id) || state.recurring.some((r) => r.catId === c.id);
    if (used) {
      c.archived = true;
      if (state.settings.focusCatId === c.id) state.settings.focusCatId = null;
      commit();
      toast(`${c.name} הועברה לארכיון — ההוצאות הקודמות נשמרו.`, { action: 'ביטול', onAction: () => { c.archived = false; commit(); } });
    } else {
      const i = state.categories.indexOf(c);
      state.categories.splice(i, 1);
      commit();
      toast(`${c.name} נמחקה`, { action: 'ביטול', onAction: () => { state.categories.splice(i, 0, c); commit(); } });
    }
  },
  unarchive: (el) => { catById(el.dataset.id).archived = false; commit(); },
  'cycle-color': (el) => {
    const c = catById(el.dataset.id);
    const i = S.PALETTE.indexOf(c.color);
    c.color = S.PALETTE[(i + 1) % S.PALETTE.length];
    commit();
    $(`[data-act="cycle-color"][data-id="${CSS.escape(c.id)}"]`)?.focus();
  },
  'set-focus-budget': () => openSettings(),
  checkin: (el) => openCheckIn(el.dataset.period || undefined),
  report: (el) => openReport(el.dataset.start),
  reminder: () => addReminder(),
  'forget-place': (el) => {
    const k = el.dataset.key;
    state.placePrefs[k] = { ...(state.placePrefs[k] || {}), hidden: true };
    commit();
    toast(`שכחתי את ״${k}״`, { action: 'ביטול', onAction: () => { state.placePrefs[k].hidden = false; commit(); } });
  },
  'unforget-place': (el) => {
    const k = el.dataset.key;
    state.placePrefs[k] = { ...(state.placePrefs[k] || {}), hidden: false };
    commit();
  },
  'dismiss-install': () => { state.settings.installHintDismissed = true; commit(); },
  backup: () => backup(),
  restore: () => restorePick(),
  csv: () => shareOrDownload(`pinkas-${today()}.csv`, L.toCSV(state), 'text/csv'),
  wipe: () => {
    if (!confirm('למחוק את כל ההוצאות, המטרות וההגדרות מהטלפון? אי אפשר לבטל את זה. כדאי לשמור גיבוי קודם.')) return;
    state = S.defaultState();
    ui.settings = false;
    ui.tab = 'home';
    commit();
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) {
    ev.preventDefault();
    fn(el);
  }
});

$('#tabs').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tab]');
  if (b) go(b.dataset.tab);
});
$('#btn-add').addEventListener('click', () => openAdd());
$('#btn-settings').addEventListener('click', () => openSettings());
$('#btn-back').addEventListener('click', () => go(ui.tab));

function openSettings() {
  ui.settings = true;
  ui.report = null;
  render();
  window.scrollTo(0, 0);
  $('#view').focus({ preventScroll: true });
}

// Inputs inside views (ledger filters, settings)
$('#view').addEventListener('input', (ev) => {
  const el = ev.target;
  // update only the results so the iPhone keyboard stays open while typing
  if (el.id === 'lq') {
    ui.ledgerQuery = el.value;
    $('#ledger-results').innerHTML = renderLedgerResults();
  }
});
// Settings edits save in place without re-rendering, so focus/keyboard never jump.
$('#view').addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.ledgerView !== undefined) {
    ui.ledgerView = el.value;
    ui.ledgerDay = null;
    render();
    $(`[data-ledger-view][value="${el.value}"]`)?.focus();
    return;
  }
  if (el.id === 'lc') {
    ui.ledgerCat = el.value;
    $('#ledger-results').innerHTML = renderLedgerResults();
    return;
  }
  if (el.dataset.setting) {
    const k = el.dataset.setting;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (k === 'cycleDay') v = L.clampCycleDay(v);
    if (k === 'alertAt') v = Number(v);
    if (k === 'waitHours') v = Number(v);
    if (k === 'checkInDay') v = L.clampCycleDay(v);
    if (k === 'currency') { v = v.trim().slice(0, 4) || '₪'; el.value = v; }
    state.settings[k] = v;
    persist();
    if (k === 'theme') applyTheme();
    if (k === 'cycleDay') $('#cycle-label').textContent = '';
    toast('נשמר');
    return;
  }
  if (el.dataset.money) {
    const a = el.value.trim() ? L.parseAmount(el.value) : 0;
    if (a === null) {
      toast('צריך מספר, למשל 3500', { alert: true });
      el.value = state.settings[el.dataset.money] ? state.settings[el.dataset.money] / 100 : '';
      return;
    }
    state.settings[el.dataset.money] = a;
    persist();
    toast('נשמר');
    return;
  }
  if (el.dataset.placeCat) {
    const k = el.dataset.placeCat;
    state.placePrefs[k] = { ...(state.placePrefs[k] || {}), catId: el.value, hidden: false };
    persist();
    toast(`מעכשיו: ${catById(el.value)?.name}`);
    return;
  }
  if (el.dataset.catName) {
    const c = catById(el.dataset.catName);
    const name = el.value.trim().slice(0, 30);
    if (!name) { el.value = c.name; return; }
    c.name = name;
    persist();
    return;
  }
  if (el.dataset.catBudget) {
    const c = catById(el.dataset.catBudget);
    const a = el.value.trim() ? L.parseAmount(el.value) : 0;
    if (a === null) {
      toast(`התקציב של ${c.name} צריך להיות מספר`, { alert: true });
      el.value = c.budget ? c.budget / 100 : '';
      return;
    }
    c.budget = a;
    persist();
    toast(`${c.name}: ${a ? money(a) + ' בחודש' : 'בלי תקציב'}`);
  }
});

// Onboarding submit
$('#view').addEventListener('submit', (ev) => {
  if (ev.target.id !== 'onb-form') return;
  ev.preventDefault();
  const food = $('#onb-food').value.trim();
  const total = $('#onb-total').value.trim();
  const fa = food ? L.parseAmount(food) : 0;
  const ta = total ? L.parseAmount(total) : 0;
  if (fa === null || ta === null) {
    $('#onb-error').textContent = 'הסכומים צריכים להיות מספרים, למשל 600.';
    return;
  }
  if (ta && fa > ta) {
    $('#onb-error').textContent = 'התקציב לאוכל בחוץ גדול מהתקציב הכולל — אחד מהם כנראה לא נכון.';
    return;
  }
  const food0 = state.categories.find((c) => c.name === 'אוכל בחוץ');
  if (food0) food0.budget = fa;
  state.settings.monthlyBudget = ta;
  state.settings.cycleDay = L.clampCycleDay($('#onb-day').value);
  state.onboarded = true;
  commit();
  $('#view').focus();
  maybePromptCheckIn();
});

/* ---------- platform ---------- */
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isStandalone() {
  return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
}
let persistAsked = false;
function requestPersistence() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}

function refreshDay() {
  if (state.spreads.length || state.expenses.some((e) => e.spreadId)) state = L.syncSpreads(state);
  const r = L.applyRecurring(state, today());
  if (r.added.length) {
    state = r.state;
    persist();
  }
  render();
}

let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && today() !== lastDay) {
    lastDay = today();
    refreshDay();
    maybePromptCheckIn();
  } else if (document.visibilityState === 'visible' && ui.tab === 'save' && !ui.settings) {
    render(); // wishlist timers
  }
});

// Other tabs/windows editing the same data
window.addEventListener('storage', (ev) => {
  if (ev.key === S.STORAGE_KEY) {
    state = S.load();
    render();
  }
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            toast('יש גרסה חדשה של פנקס', { action: 'לרענן', onAction: () => location.reload(), ms: 15000 });
          }
        });
      });
    }).catch((err) => console.warn('sw registration failed', err));
  });
}

/* ---------- boot ---------- */
refreshDay();
const params = new URLSearchParams(location.search);
if (state.onboarded && (params.get('action') === 'add' || location.hash === '#add')) {
  history.replaceState(null, '', location.pathname);
  openAdd();
} else {
  maybePromptCheckIn();
}

// expose for debugging in the console only
window.__pinkas = { get state() { return state; }, L, S, version: VERSION };
