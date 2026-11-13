// חיסכון: the piggy bank, the money map (net worth), skipped purchases, goals, the cooling-off list, no-spend days.
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import * as L from '../lib/logic.js';
import { useData, useMoney, today } from '../hooks/useApp.js';
import { useActions } from '../hooks/useActions.jsx';
import { D } from '../store/dataSlice.js';
import { useOverlay } from '../components/UiProvider.jsx';
import { CountUp, M, Sparkline } from '../components/ui.jsx';
import { Piggy } from '../components/Piggy.jsx';

export const piggyGoal = (state) => state.goals.find((g) => g.id === state.settings.piggyGoalId && g.saved < g.target)
  || state.goals.find((g) => g.saved < g.target) || null;

function PiggyBox({ state }) {
  const dispatch = useDispatch();
  const act = useActions();
  const { piggyFrom, setPiggyFrom } = useOverlay();
  const g = piggyGoal(state);
  // the "before" level is used once, for the fill animation after a deposit
  useEffect(() => { if (piggyFrom !== null) setPiggyFrom(null); }, [piggyFrom, setPiggyFrom]);
  if (!g) {
    return (
      <section className="piggy-box" aria-labelledby="pg-h">
        <div className="piggy-art"><Piggy level={0} label="קופה ריקה" /></div>
        <div className="piggy-info">
          <p className="eyebrow" id="pg-h">קופת החיסכון</p>
          <p className="piggy-goal">{state.goals.length ? 'כל המטרות הושגו' : 'בשביל מה חוסכים?'}</p>
          <p className="small muted">מטרה עם שם וסכום — והקופה מתמלאת עם כל שקל שחסכת.</p>
          <button type="button" className="btn btn-primary btn-small" onClick={() => act.openGoal()}>מטרה {state.goals.length ? 'חדשה' : 'ראשונה'}</button>
        </div>
      </section>
    );
  }
  const ratio = g.saved / g.target;
  const open = state.goals.filter((x) => x.saved < x.target);
  const switchGoal = () => {
    const i = open.findIndex((x) => x.id === g.id);
    dispatch(D.setSetting({ key: 'piggyGoalId', value: open[(i + 1) % open.length].id }));
  };
  return (
    <section className="piggy-box" aria-labelledby="pg-h">
      <div className="piggy-art"><Piggy key={g.id} level={ratio} from={piggyFrom} label={`${Math.round(ratio * 100)} אחוז מהמטרה ${g.name}`} /></div>
      <div className="piggy-info">
        <p className="eyebrow" id="pg-h">קופת החיסכון</p>
        <p className="piggy-goal">{g.name}</p>
        <p className="piggy-num"><CountUp a={g.saved} /> <span className="muted small">מתוך <M a={g.target} round /></span></p>
        <p className="small muted">{Math.round(ratio * 100)}% · חסרים <M a={g.target - g.saved} round /></p>
        <div className="piggy-actions">
          <button type="button" className="btn btn-primary btn-small" onClick={() => act.openDeposit(g)}>הפקדה</button>
          {open.length > 1 && <button type="button" className="link small" onClick={switchGoal}>מטרה אחרת</button>}
        </div>
      </div>
    </section>
  );
}

const SEG = { liquid: 'seg-cash', invest: 'seg-inv', longterm: 'seg-sav' };

export function NetWorth({ state }) {
  const act = useActions();
  const money = useMoney();
  const series = L.netWorthSeries(state.snapshots);
  const ci = L.checkInStatus(state, today());
  if (!series.length) {
    return (
      <section className="vault nw" aria-labelledby="nw-h">
        <p className="vault-label" id="nw-h">מפת הכסף שלך</p>
        <p className="nw-empty">עו״ש, מזומן, פיקדונות, תיק השקעות, קרן השתלמות ופנסיה — הכל במקום אחד. פעם בחודש, ב־{state.settings.checkInDay} לחודש, מעדכנים ורואים את ההון גדל.</p>
        <button type="button" className="btn btn-gold" onClick={() => act.openCheckIn()}>צ׳ק־אין ראשון</button>
      </section>
    );
  }
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const change = prev ? last.total - prev.total : null;
  const total = Math.max(1, last.total);
  const label = `השווי לאורך ${series.length} חודשים: ` + series.map((s) => `${L.monthLabelFromKey(s.period)} ${money(s.total, { round: true })}`).join(', ');
  return (
    <section className="vault nw" aria-labelledby="nw-h">
      <div className="nw-top">
        <p className="vault-label" id="nw-h">מפת הכסף שלך · {L.monthLabelFromKey(last.period)}</p>
        <button type="button" className="link link-on-dark" onClick={() => act.openCheckIn(ci.due ? ci.period : last.period)}>{ci.due ? 'צ׳ק־אין חדש' : 'עדכון'}</button>
      </div>
      <p className="nw-num"><CountUp a={last.total} /></p>
      {change !== null && <p className={`nw-change ${change >= 0 ? 'up' : 'down'}`}>{change >= 0 ? '▲' : '▼'} <M a={Math.abs(change)} round /> מהחודש הקודם</p>}
      <Sparkline values={series.map((s) => s.total)} label={label} />
      <div className="nw-bar" aria-hidden="true">
        {L.ASSET_GROUPS.filter((g) => last[g.key] > 0).map((g) => <span key={g.key} className={SEG[g.key]} style={{ width: `${((last[g.key] / total) * 100).toFixed(1)}%` }} />)}
      </div>
      <ul className="nw-legend">
        {L.ASSET_GROUPS.map((g) => <li key={g.key}><i className={SEG[g.key]} aria-hidden="true" /><span>{g.label}</span><M a={last[g.key]} round /></li>)}
      </ul>
      <details className="nw-details">
        <summary>לפי סוג</summary>
        <ul>{L.ASSET_TYPES.filter((a) => last.assets[a.key]).map((a) => <li key={a.key}><span>{a.label}</span><M a={last.assets[a.key]} round /></li>)}</ul>
      </details>
    </section>
  );
}

export function SavePage() {
  const state = useData();
  const dispatch = useDispatch();
  const money = useMoney();
  const act = useActions();
  const { toast, openAdd } = useOverlay();
  const t = today();
  const cycle = L.cycleFor(t, state.settings.cycleDay);
  const resistedNow = state.resisted.filter((r) => L.inCycle(r.date, cycle));
  const resistedTotal = L.sumBy(state.resisted);
  const skipped = state.wishlist.filter((w) => w.status === 'skipped');
  const waiting = state.wishlist.filter((w) => w.status === 'waiting').sort((a, b) => a.addedAt - b.addedAt);
  const cal = L.noSpendCalendar(state, cycle, t);
  const firstDow = L.fromISO(cycle.start).getDay();

  const delResist = (r) => {
    dispatch(D.removeResisted(r.id));
    toast('נמחק', { action: 'ביטול', onAction: () => dispatch(D.restoreResisted(r)) });
  };
  const wishSkip = (w) => {
    dispatch(D.setWishStatus({ id: w.id, status: 'skipped' }));
    dispatch(D.addResisted({ name: w.name, amount: w.amount, date: t, goalId: null, catId: w.catId }));
    toast(`${money(w.amount)} נשארו אצלך. כל הכבוד.`);
  };
  const wishBuy = (w) => {
    dispatch(D.setWishStatus({ id: w.id, status: 'bought' }));
    openAdd({ catId: w.catId || undefined, amount: w.amount, note: w.name });
  };

  return (
    <>
      <PiggyBox state={state} />
      <NetWorth state={state} />

      <section className="save-intro" aria-labelledby="res-h">
        <p className="eyebrow" id="res-h">נשאר אצלך בזכות ויתורים, במחזור הזה</p>
        <p className="big-stat"><M a={L.sumBy(resistedNow)} round /></p>
        <p className="muted small">{resistedTotal ? <>מאז שהתחלת: <M a={resistedTotal} round /> ב־{state.resisted.length} ויתורים</> : 'ויתרת על קפה, משלוח או קנייה? לרשום את זה כאן — זה כסף שנשאר.'}</p>
        <button type="button" className="btn btn-primary" onClick={() => act.openResist()}>ויתרתי על משהו</button>
      </section>

      {resistedNow.length > 0 && (
        <section>
          <ul className="plain-list">
            {[...resistedNow].reverse().slice(0, 6).map((r) => (
              <li key={r.id}>
                <span>{r.name || 'ויתור'} <span className="small muted">· {L.dayLabel(r.date, t)}</span></span>
                <span><M a={r.amount} /> <button type="button" className="link small" aria-label={`מחיקת הוויתור ${r.name}`} onClick={() => delResist(r)}>מחיקה</button></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="goals-h">
        <div className="sec-head"><h2 className="sec-title" id="goals-h">מטרות חיסכון</h2><button type="button" className="link" onClick={() => act.openGoal()}>מטרה חדשה</button></div>
        {state.goals.length ? state.goals.map((g) => {
          const ratio = Math.min(1, g.saved / g.target);
          const done = g.saved >= g.target;
          return (
            <div className="goal" key={g.id}>
              <div className="goal-top"><span className="goal-name">{g.name}</span><span><M a={g.saved} round /> <span className="muted small">/ <M a={g.target} round /></span></span></div>
              <div className="bar" role="img" aria-label={`${Math.round(ratio * 100)} אחוז מהמטרה`}><span className="bar-fill" style={{ width: `${(ratio * 100).toFixed(1)}%` }} /></div>
              <div className="goal-actions">
                <span className={`small ${done ? 'pos' : 'muted'}`}>{done ? 'הושגה!' : <>חסרים <M a={g.target - g.saved} round /></>}</span>
                <button type="button" className="link" onClick={() => act.openDeposit(g)}>הפקדה</button>
                <button type="button" className="link" onClick={() => act.openGoal(g)}>עריכה</button>
              </div>
            </div>
          );
        }) : <p className="block-p">למה חוסכים? טיסה, מחשב, כרית ביטחון. מטרה עם שם ומספר עוזרת לוותר בקלות.</p>}
      </section>

      <section className="section-gap" aria-labelledby="wish-h">
        <div className="sec-head"><h2 className="sec-title" id="wish-h">רשימת המתנה</h2><button type="button" className="link" onClick={act.openWish}>להוסיף</button></div>
        <p className="block-p">רוצה לקנות משהו שלא תכננת? מכניסים אותו לכאן ל־{state.settings.waitHours} שעות. אם עדיין רוצה אחרי זה — קונים בלב שלם.</p>
        {waiting.map((w) => {
          const ws = L.wishState(w);
          return (
            <div className="wish" key={w.id}>
              <div className="wish-top"><strong>{w.name}</strong><M a={w.amount} /></div>
              <p className={`wish-status ${ws.ready ? 'ready' : ''}`}>{ws.ready ? 'זמן ההמתנה נגמר. עדיין רוצה?' : `${L.formatWait(ws.msLeft)} של המתנה`}</p>
              <div className="wish-actions">
                {ws.ready ? (
                  <>
                    <button type="button" className="btn btn-small btn-primary" onClick={() => wishSkip(w)}>ויתרתי</button>
                    <button type="button" className="btn btn-small btn-line" onClick={() => wishBuy(w)}>קניתי</button>
                  </>
                ) : <button type="button" className="btn btn-small btn-line" onClick={() => wishSkip(w)}>כבר לא רוצה</button>}
                <button type="button" className="link small" onClick={() => dispatch(D.removeWish(w.id))}>הסרה</button>
              </div>
            </div>
          );
        })}
        {skipped.length > 0 && <p className="small muted" style={{ marginTop: 10 }}>ויתרת על {skipped.length} דברים מהרשימה — <M a={L.sumBy(skipped)} round /> שנשארו בכיס.</p>}
      </section>

      <section className="section-gap" aria-labelledby="cal-h">
        <div className="sec-head"><h2 className="sec-title" id="cal-h">ימים בלי הוצאות</h2></div>
        <p className="block-p">{cal.noSpend ? `${cal.noSpend} ימים בלי אף הוצאה במחזור הזה${cal.streak > 1 ? `, ${cal.streak} ברצף עד אתמול` : ''}.` : 'יום שבו לא הוצאת כלום (מלבד חיובים קבועים) נצבע בירוק. נסו לצבוע שניים בשבוע.'}</p>
        <div className="cal" role="list" aria-label="לוח המחזור">
          {L.WEEKDAYS_SHORT.map((d) => <span key={d} className="cal-wd" aria-hidden="true">{d}</span>)}
          {Array.from({ length: firstDow }, (_, i) => <span key={`b${i}`} aria-hidden="true" />)}
          {cal.days.map((d) => {
            const dd = L.fromISO(d.date);
            const cls = d.today ? 'is-today' : d.future ? 'is-future' : d.spent ? 'is-spent' : 'is-free';
            const label = `${dd.getDate()} ב${L.MONTHS_SHORT[dd.getMonth()]}: ${d.future ? 'עוד לא הגיע' : d.spent ? `הוצאת ${money(d.spent)}` : d.today ? 'היום' : 'בלי הוצאות'}`;
            return <span key={d.date} className={`cal-day ${cls}`} role="listitem" aria-label={label}>{dd.getDate()}</span>;
          })}
        </div>
        <div className="cal-legend" aria-hidden="true">
          <span><i style={{ background: 'var(--good)' }} />בלי הוצאות</span>
          <span><i style={{ background: 'var(--paper-2)', border: '1px solid var(--rule-soft)' }} />היו הוצאות</span>
        </div>
      </section>
    </>
  );
}
