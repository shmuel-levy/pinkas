// יומן: every entry of a cycle — list or month grid, search and category filter.
import { useDispatch } from 'react-redux';
import * as L from '../lib/logic.js';
import { useData, useMoney, useUi, useCatById, today } from '../hooks/useApp.js';
import { U } from '../store/uiSlice.js';
import { useOverlay } from '../components/UiProvider.jsx';
import { M } from '../components/ui.jsx';
import { ExpenseRow, IncomeRow, byNewest } from '../components/Rows.jsx';
import { Tip } from '../components/Tip.jsx';

// short number for a narrow calendar cell: 75, 1.2K, 15K (the full amount is in the cell's label)
export function cellNum(a) {
  const v = Math.round(a / 100);
  if (v < 1000) return String(v);
  return (Math.floor(v / 100) / 10).toFixed(v < 100000 ? 1 : 0).replace(/\.0$/, '') + 'K';
}

function Calendar({ cycle, state }) {
  const money = useMoney();
  const { openDay } = useOverlay();
  const t = today();
  const totals = L.dailyTotals(state, cycle);
  const firstDow = L.fromISO(cycle.start).getDay();
  const cells = [];
  for (let d = cycle.start; d < cycle.end; d = L.addDays(d, 1)) {
    const x = totals.get(d) || { spent: 0, income: 0 };
    const dd = L.fromISO(d);
    const label = `${dd.getDate()} ב${L.MONTHS_SHORT[dd.getMonth()]}: ${x.spent ? `הוצאות ${money(x.spent)}` : 'בלי הוצאות'}${x.income ? `, הכנסות ${money(x.income)}` : ''}`;
    cells.push(
      <button key={d} type="button" className={`calx-day${d === t ? ' is-today' : ''}${d > t ? ' is-future' : ''}`}
        aria-label={`${label}. פתיחת היום`} onClick={() => openDay(d)}>
        <span className="calx-n">{dd.getDate()}</span>
        {x.spent > 0 && <span className="calx-out" aria-hidden="true">{cellNum(x.spent)}</span>}
        {x.income > 0 && <span className="calx-in" aria-hidden="true">+{cellNum(x.income)}</span>}
      </button>,
    );
  }
  return (
    <div className="calx" role="group" aria-label="לוח המחזור: לחיצה על יום פותחת את כל מה שקרה בו">
      {L.WEEKDAYS_SHORT.map((w) => <span key={w} className="cal-wd" aria-hidden="true">{w}</span>)}
      {Array.from({ length: firstDow }, (_, i) => <span key={`b${i}`} aria-hidden="true" />)}
      {cells}
    </div>
  );
}

export function LedgerPage() {
  const state = useData();
  const { ledger } = useUi();
  const dispatch = useDispatch();
  const catById = useCatById();
  const { openAdd, openDay } = useOverlay();
  const set = (x) => dispatch(U.setLedger(x));
  const t = today();
  const cycle = L.shiftCycle(L.cycleFor(t, state.settings.cycleDay), ledger.offset);
  const exps = L.expensesInCycle(state.expenses, cycle).filter((e) => e.date <= t || ledger.offset < 0);
  const allIncs = L.incomesInCycle(state, cycle);
  const spent = L.sumBy(exps);
  const earned = L.sumBy(allIncs);

  // results
  const q = ledger.query.trim().toLowerCase();
  let list = L.expensesInCycle(state.expenses, cycle);
  // future-dated fixed shares (insurance) stay out of the current month's list until their day
  if (ledger.offset >= 0) list = list.filter((e) => e.date <= t || e.date === ledger.day);
  let incs = ledger.cat ? [] : allIncs;
  if (ledger.cat) list = list.filter((e) => e.catId === ledger.cat);
  if (ledger.day) {
    list = list.filter((e) => e.date === ledger.day);
    incs = incs.filter((i) => i.date === ledger.day);
  }
  if (q) {
    list = list.filter((e) => (e.note || '').toLowerCase().includes(q) || (catById(e.catId)?.name || '').includes(q) || String(e.amount / 100).includes(q));
    incs = incs.filter((i) => (i.note || '').toLowerCase().includes(q) || i.source.includes(q) || String(i.amount / 100).includes(q));
  }
  list = [...list].sort(byNewest);
  const filtered = q || ledger.cat || ledger.day;
  const groups = new Map();
  const g = (d) => {
    if (!groups.has(d)) groups.set(d, { exps: [], incs: [] });
    return groups.get(d);
  };
  for (const e of list) g(e.date).exps.push(e);
  for (const i of incs) g(i.date).incs.push(i);
  const days = [...groups.keys()].sort().reverse();
  const count = list.length + incs.length;

  return (
    <>
      <div className="cycle-nav">
        <button type="button" aria-label="למחזור הקודם" onClick={() => set({ offset: ledger.offset - 1, day: null })}>→</button>
        <div className="cycle-nav-label" aria-live="polite"><strong>{L.cycleLabel(cycle)}</strong></div>
        <button type="button" aria-label="למחזור הבא" disabled={ledger.offset >= 0} onClick={() => set({ offset: Math.min(0, ledger.offset + 1), day: null })}>←</button>
      </div>
      <dl className="ledger-sum">
        <div><dt>הכנסות</dt><dd className="pos"><M a={earned} round /></dd></div>
        <div><dt>הוצאות</dt><dd><M a={spent} round /></dd></div>
        <div><dt>יתרה</dt><dd className={earned - spent < 0 ? 'neg' : ''}><M a={earned - spent} round /></dd></div>
      </dl>
      <Tip id="ledger" title="מה זה היומן">כל הוצאה והכנסה שרשמת, מסודרות לפי ימים. בלוח החודשי אפשר ללחוץ על כל יום ולראות בדיוק מה היה בו.</Tip>
      <div className="ledger-tools">
        <div className="seg" role="radiogroup" aria-label="תצוגה">
          <label><input type="radio" name="lview" value="list" checked={ledger.view === 'list'} onChange={() => set({ view: 'list', day: null })} /><span>רשימה</span></label>
          <label><input type="radio" name="lview" value="cal" checked={ledger.view === 'cal'} onChange={() => set({ view: 'cal' })} /><span>לוח חודשי</span></label>
        </div>
      </div>
      {ledger.view === 'cal' && <Calendar cycle={cycle} state={state} />}
      <div className="filters">
        <label className="sr-only" htmlFor="lq">חיפוש ביומן</label>
        <input id="lq" className="field" type="search" placeholder="חיפוש" value={ledger.query} autoComplete="off" enterKeyHint="search"
          onChange={(e) => set({ query: e.target.value })} />
        <label className="sr-only" htmlFor="lc">סינון לפי קטגוריה</label>
        <select id="lc" className="field" value={ledger.cat} onChange={(e) => set({ cat: e.target.value })}>
          <option value="">כל הקטגוריות</option>
          {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (בארכיון)' : ''}</option>)}
        </select>
      </div>
      <div id="ledger-results">
        <div className="ledger-total">
          <span className="muted small">{count ? `${count} רשומות${ledger.day ? ` ב${L.dayLabel(ledger.day, t)}` : ''}` : ''}</span>
          {ledger.day
            ? <button type="button" className="link small" onClick={() => set({ day: null })}>כל הימים</button>
            : <M a={L.sumBy(list)} round />}
        </div>
        <div className="ledger-wrap">
          {count ? days.map((date) => {
            const { exps: ex, incs: ins } = groups.get(date);
            return (
              <div className="day-group" key={date}>
                <div className="day-head">
                  <button type="button" className="day-head-btn" onClick={() => openDay(date)} aria-label={`${L.dayLabel(date, t)}: פתיחת היום`}>{L.dayLabel(date, t)}</button>
                  <span>{ins.length > 0 && <><span className="pos"><M a={L.sumBy(ins)} signed /></span> </>}{ex.length > 0 && <M a={L.sumBy(ex)} />}</span>
                </div>
                <ul className="rows">
                  {ins.map((i) => <IncomeRow key={i.id} i={i} t={t} />)}
                  {ex.map((e) => <ExpenseRow key={e.id} e={e} t={t} />)}
                </ul>
              </div>
            );
          }) : (
            <section className="empty">
              <h2>{filtered ? 'לא נמצאו רישומים' : 'אין רישומים במחזור הזה'}</h2>
              <p>{ledger.day && !q && !ledger.cat ? 'ביום הזה לא נרשם כלום.' : filtered ? 'נסו מילה אחרת או בטלו את הסינון.' : 'כל הוצאה והכנסה שתרשמו תופיע כאן, מסודרת לפי ימים.'}</p>
              {filtered
                ? <button type="button" className="btn btn-line" onClick={() => set({ query: '', cat: '', day: null })}>ביטול הסינון</button>
                : <button type="button" className="btn btn-primary" onClick={() => openAdd()}>לרשום הוצאה</button>}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
