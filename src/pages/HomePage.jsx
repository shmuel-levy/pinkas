// ראשי: how much you have, how much you may spend today, the month's envelopes, latest entries.
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import * as L from '../lib/logic.js';
import { useData, useMoney, daysWord, today } from '../hooks/useApp.js';
import { useActions } from '../hooks/useActions.jsx';
import { U } from '../store/uiSlice.js';
import { D } from '../store/dataSlice.js';
import { platform, isStandalone } from '../lib/platform.js';
import { budgetAnswers } from './QuizPage.jsx';
import { Bar, CountUp, Dot, M } from '../components/ui.jsx';
import { ExpenseRow, byNewest } from '../components/Rows.jsx';
import { AskProfile, FirstSteps, Hello } from '../components/Personal.jsx';
import { Tip } from '../components/Tip.jsx';

export function focusCat(state) {
  const active = state.categories.filter((c) => !c.archived);
  const c = state.settings.focusCatId && state.categories.find((x) => x.id === state.settings.focusCatId);
  if (c && !c.archived) return c;
  return active.find((x) => x.name === 'אוכל בחוץ') || active.find((x) => x.budget) || null;
}

// policies ending within 30 days that haven't been renewed yet
export function renewalsDue(state, t) {
  return state.spreads.filter((s) => L.spreadInfo(s, t).renewSoon && !state.spreads.some((o) => o !== s && o.name === s.name && o.start > s.start));
}

// the home numbers count up once per session, not on every visit
let homeCounted = false;

const Go = () => <span className="notice-go" aria-hidden="true">←</span>;

export function HomePage() {
  const state = useData();
  const dispatch = useDispatch();
  const money = useMoney();
  const act = useActions();
  const t = today();
  const sum = L.cycleSummary(state, t);
  const o = sum.overall;
  const fc = focusCat(state);
  const ci = L.checkInStatus(state, t);
  const renew = renewalsDue(state, t);
  const bal = L.liveBalances(state, t);
  const [animate] = useState(() => !homeCounted);
  useEffect(() => { homeCounted = true; }, []);

  const alerts = [];
  for (const { cat, status } of sum.cats) {
    if (!status.hasBudget) continue;
    if (status.state === 'over') alerts.push({ over: true, cat, text: <>{cat.name}: חריגה של <M a={-status.left} /></> });
    else if (status.state === 'warn') alerts.push({ cat, text: <>{cat.name}: נשארו רק <M a={status.left} /></> });
  }
  const budgeted = sum.cats.filter((r) => r.status.hasBudget)
    .sort((a, b) => (fc && a.cat.id === fc.id ? -1 : fc && b.cat.id === fc.id ? 1 : 0));
  const recent = state.expenses.filter((e) => e.date <= t).sort(byNewest).slice(0, 4);
  const daysSinceBackup = state.settings.lastBackupAt ? Math.floor((Date.now() - state.settings.lastBackupAt) / 86400000) : null;
  const showInstallHint = platform().ios && !isStandalone() && !state.settings.installHintDismissed;

  return (
    <>
      {showInstallHint && (
        <div className="hint-box" role="note">
          <strong>להוסיף למסך הבית</strong>בספארי: שיתוף ← ״הוספה למסך הבית״.{' '}
          <button type="button" className="link" onClick={() => dispatch(D.setSetting({ key: 'installHintDismissed', value: true }))}>הבנתי</button>
        </div>
      )}

      <Hello />
      <AskProfile />

      {(ci.due || renew.length > 0) && (
        <div className="notices">
          {renew.map((s) => {
            const d = L.spreadInfo(s, t).daysToEnd;
            return (
              <button key={s.id} type="button" className="notice" onClick={() => act.openSpread(s)}>
                <span className="notice-k">{s.name} מתחדש {d === 0 ? 'היום' : d === 1 ? 'מחר' : `בעוד ${d} ימים`}</span>
                <span className="notice-t">זה הזמן להשוות מחירים.</span><Go />
              </button>
            );
          })}
          {ci.due && (
            <button type="button" className="notice" onClick={() => act.openCheckIn()}>
              <span className="notice-k">צ׳ק־אין {L.MONTHS[Number(ci.period.slice(5, 7)) - 1]}</span>
              <span className="notice-t">מעדכנים יתרות והכנסה. דקה אחת.</span><Go />
            </button>
          )}
        </div>
      )}

      <section className="balances" aria-labelledby="bal-h">
        <div className="home-head">
          <h2 className="home-title" id="bal-h">היתרה שלך</h2>
          <button type="button" className="link small" onClick={act.openBalances}>עדכון</button>
        </div>
        {bal ? (
          <div className="bal-grid">
            <button type="button" className="bal-tile" onClick={act.openBalances}>
              <span className="bal-k">עו״ש{state.settings.bank ? ` · ${L.bankName(state.settings.bank)}` : ''}</span>
              <span className={`bal-v ${bal.checking < 0 ? 'neg' : ''}`}><CountUp a={bal.checking} duration={1100} animate={animate} /></span>
            </button>
            <button type="button" className="bal-tile" onClick={act.openBalances}>
              <span className="bal-k">מזומן</span>
              <span className={`bal-v ${bal.cash < 0 ? 'neg' : ''}`}><M a={bal.cash} round /></span>
            </button>
          </div>
        ) : <button type="button" className="btn btn-line btn-small" onClick={act.openBalances}>להזין כמה יש בעו״ש</button>}
      </section>

      <FirstSteps />

      {o.hasBudget && state.settings.monthlyBudget ? (
        <section className="hero vault" aria-labelledby="hero-l">
          <p className="eyebrow" id="hero-l">{o.todayLeft < 0 ? 'חרגת היום ב־' : 'מותר להוציא היום'}</p>
          <p className={`hero-num ${o.todayLeft < 0 ? 'neg' : ''}`}><CountUp a={Math.abs(o.todayLeft)} duration={1100} animate={animate} /></p>
          <p className="hero-sub">
            {o.left >= 0 ? <>נשארו <M a={o.left} round /> לעוד {daysWord(o.daysLeft)} בחודש</> : <>החודש עברת את התקציב ב־<M a={-o.left} round /></>}
          </p>
        </section>
      ) : (
        <section className="budget-cta vault" aria-labelledby="bcta-h">
          <p className="vault-label">היום</p>
          <h2 className="bcta-title" id="bcta-h">כמה מותר לך להוציא?</h2>
          <p className="hero-sub">3 שאלות קצרות, ושקל בצד יגיד לך כל יום כמה אפשר להוציא — ויעצור לפני חריגה.</p>
          <button type="button" className="btn btn-gold" onClick={() => dispatch(U.startQuiz({ id: 'budget', answers: budgetAnswers(state) }))}>להגדיר תקציב</button>
        </section>
      )}

      {o.hasBudget && state.settings.monthlyBudget ? (
        <Tip id="hero" title="מה זה ״מותר להוציא היום״?">מה שנשאר מהתקציב החודשי, מחולק לימים שנשארו. נשארת מתחת? היתרה עוברת למחר. חרגת? מחר יהיה קצת פחות.</Tip>
      ) : null}

      {alerts.length > 0 && (
        <ul className="alerts" aria-label="התראות תקציב">
          {alerts.slice(0, 3).map((a) => <li key={a.cat.id} className={a.over ? 'is-over' : ''}><span>{a.text}</span></li>)}
        </ul>
      )}

      {budgeted.length > 0 && (
        <section aria-labelledby="env-h">
          <div className="home-head">
            <h2 className="home-title" id="env-h">התקציב החודשי</h2>
            <button type="button" className="link small" onClick={() => dispatch(U.openSub({ sub: 'settings' }))}>עריכה</button>
          </div>
          <ul className="env-list">
            {budgeted.map(({ cat, status: st }) => (
              <li className="env" key={cat.id}>
                <button type="button" className="env-btn" onClick={() => dispatch(U.ledgerCategory(cat.id))}
                  aria-label={`${cat.name}: ${money(st.spent)} מתוך ${money(st.budget)}`}>
                  <div className="env-top">
                    <span className="env-name"><Dot color={cat.color} />{cat.name}</span>
                    <span className="env-amt"><M a={st.spent} round /> <span className="of">/ <M a={st.budget} round /></span></span>
                  </div>
                  <Bar st={st} />
                  <p className={`env-note ${st.state === 'over' ? 'is-over' : st.state === 'warn' ? 'is-warn' : ''}`}>
                    {st.state === 'over' ? <>חריגה של <M a={-st.left} /></> : <>נשארו <M a={st.left} round /></>}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="קיצורי דרך">
        <div className="shortcuts">
          <button type="button" className="shortcut" onClick={() => dispatch(U.openSub({ sub: 'insights' }))}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V12M10 20V6M15 20v-9M20 20V9" /></svg>
            <span><strong>תובנות</strong><small>לאן הלך הכסף</small></span>
          </button>
          <button type="button" className="shortcut" onClick={() => dispatch(U.openSub({ sub: 'report', reportStart: sum.cycle.start }))}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" /><path d="M10 12h5M10 15.5h5" /></svg>
            <span><strong>הכנסות מול הוצאות</strong><small>החודש עד עכשיו</small></span>
          </button>
        </div>
      </section>

      {recent.length ? (
        <>
          <section aria-labelledby="rec-h" className="block-recent">
            <div className="home-head">
              <h2 className="home-title" id="rec-h">רישומים אחרונים</h2>
              <button type="button" className="link small" onClick={() => dispatch(U.goTab('ledger'))}>הכל</button>
            </div>
          </section>
          <ul className="rows">{recent.map((e) => <ExpenseRow key={e.id} e={e} t={t} showDate />)}</ul>
        </>
      ) : (
        <section className="empty">
          <h2>עוד אין רישומים</h2>
          <p>לוחצים על + ורושמים את ההוצאה הראשונה. לוקח חמש שניות.</p>
        </section>
      )}

      {state.expenses.length >= 15 && (daysSinceBackup === null || daysSinceBackup > 30) && (
        <div className="hint-box">
          <strong>{daysSinceBackup === null ? 'עוד לא גיבית' : `הגיבוי האחרון לפני ${daysSinceBackup} ימים`}</strong>
          הנתונים שמורים רק בטלפון הזה. <button type="button" className="link" onClick={act.backup}>לשמור גיבוי</button>
        </div>
      )}
    </>
  );
}
