// Full-screen moments: goal reached, first-run welcome, the daily streak, the streak calendar, page guides.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as L from '../lib/logic.js';
import { burst, reduced, tick } from '../lib/fx.js';
import { D } from '../store/dataSlice.js';
import { Sheet } from './Sheet.jsx';
import { useOverlay } from './UiProvider.jsx';
import { useActions } from '../hooks/useActions.jsx';
import { useMoney } from '../hooks/useApp.js';
import { FlamingPiggy, Piggy } from './Piggy.jsx';

/* ---------- goal reached: the piggy explodes ---------- */
function CelebrateBody({ goal, close, setBurstOn }) {
  const money = useMoney();
  const act = useActions();
  const art = useRef(null);
  useEffect(() => {
    if (reduced()) { setBurstOn(true); return undefined; }
    const id = setTimeout(() => {
      setBurstOn(true);
      burst(art.current);
      tick(40);
    }, 900);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="sheet-body">
      <div className="celebrate-art" ref={art}><Piggy level={1} label="הקופה מלאה" /></div>
      <h2 id="celebrate-title">הגעת ליעד: {goal.name}</h2>
      <p className="over-text">{money(goal.saved, { round: true })} נחסכו. זה הזמן ליהנות מזה — ולבחור את המטרה הבאה.</p>
      <div className="sheet-actions">
        <button type="button" className="btn btn-primary" onClick={() => { close(); setTimeout(() => act.openGoal(), 50); }}>מטרה חדשה</button>
        <button type="button" className="link" data-close>סגירה</button>
      </div>
    </div>
  );
}
export function Celebrate() {
  const { celebrate, closeCelebrate } = useOverlay();
  const [burstOn, setBurstOn] = useState(false);
  useEffect(() => { if (!celebrate) setBurstOn(false); }, [celebrate]);
  return (
    <Sheet open={!!celebrate} onClose={closeCelebrate} className={`sheet sheet-celebrate${burstOn ? ' is-burst' : ''}`} labelledBy="celebrate-title">
      {celebrate && <CelebrateBody goal={celebrate} close={closeCelebrate} setBurstOn={setBurstOn} />}
    </Sheet>
  );
}

/* ---------- first-run welcome ---------- */
export function Welcome() {
  const { welcome, setWelcome } = useOverlay();
  const dispatch = useDispatch();
  const go = useRef(null);
  useEffect(() => { if (welcome) go.current?.focus({ preventScroll: true }); }, [welcome]);
  return (
    <Sheet open={welcome} onClose={() => setWelcome(false)} className="sheet sheet-welcome" labelledBy="welcome-title" closeOnBackdrop={false}>
      <div className="sheet-body">
        <img className="welcome-logo" src="icons/icon-192.png" alt="" width="88" height="88" />
        <h2 id="welcome-title">ברוך הבא לפנקס</h2>
        <p className="welcome-text">הכסף שלך, במקום אחד. פעם ראשונה כאן? ההדרכה לוקחת דקה ומראה את הדברים הכי חשובים.</p>
        <div className="sheet-actions">
          {/* closing hands over to the startup sequence, which starts the home guide (not seen yet) */}
          <button type="button" className="btn btn-primary" ref={go} onClick={() => setWelcome(false)}>המשך להדרכה</button>
          <button type="button" className="link" onClick={() => { dispatch(D.markTourSeen('home')); setWelcome(false); }}>דילוג</button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- the daily streak moment ---------- */
function StreakFxBody({ close }) {
  const visits = useSelector((s) => s.data.visits);
  const dispatch = useDispatch();
  const t = L.todayISO();
  const [n] = useState(() => L.streakCount(visits, t));
  const [best] = useState(() => L.bestStreak(visits));
  const ok = useRef(null);
  useEffect(() => {
    dispatch(D.setSetting({ key: 'streakShown', value: t }));
    tick(30);
    ok.current?.focus({ preventScroll: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="sfx-inner">
      <div className="sfx-art" aria-hidden="true"><FlamingPiggy streak={n} /></div>
      <p className="sfx-num"><span className="sfx-old">{Math.max(0, n - 1)}</span><span className="sfx-new">{n}</span></p>
      <h2 id="streak-fx-title">{n === 1 ? 'יום ראשון ברצף' : `${n} ימים ברצף`}</h2>
      <p className="sfx-text">
        {n === 1 ? 'כל יום שנכנסים לפנקס — הקופה מתחממת. נתראה מחר.' : n >= best && n > 2 ? 'שיא חדש. ככה בונים הרגל.' : 'חזרת גם היום. עוד יום נוסף לרצף.'}
      </p>
      <button type="button" className="btn btn-gold" ref={ok} onClick={close}>יאללה</button>
    </div>
  );
}
export function StreakFx() {
  const { streakFx, setStreakFx } = useOverlay();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!streakFx) return setOn(false);
    // two frames so the "before" state paints, then the flip animates
    let r2;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setOn(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [streakFx]);
  return (
    <Sheet open={streakFx} onClose={() => setStreakFx(false)} className={`streak-fx ${on ? 'is-on' : ''}`} labelledBy="streak-fx-title" closeOnBackdrop={false}>
      {streakFx && <StreakFxBody close={() => setStreakFx(false)} />}
    </Sheet>
  );
}

/* ---------- streak calendar ---------- */
function StreakCalendar({ monthKey, setMonth }) {
  const state = useSelector((s) => s.data);
  const t = L.todayISO();
  const n = L.streakCount(state.visits, t);
  const best = L.bestStreak(state.visits);
  const mo = L.activityMonth(state, monthKey, t);
  const isCur = monthKey === L.monthKey(t);
  return (
    <div>
      <div className="streak-top">
        <FlamingPiggy streak={n} />
        <div>
          <p className="streak-big"><span className="num">{n}</span> <span>ימים ברצף</span></p>
          <p className="small muted">השיא שלך: {best} ימים</p>
        </div>
      </div>
      <div className="cal-nav">
        <button type="button" aria-label="לחודש הקודם" onClick={() => setMonth(L.nextMonthKey(monthKey, -1))}>→</button>
        <strong>{L.monthLabelFromKey(monthKey)}</strong>
        <button type="button" aria-label="לחודש הבא" disabled={isCur} onClick={() => setMonth(L.nextMonthKey(monthKey, 1))}>←</button>
      </div>
      <div className="scal" role="list" aria-label="פעילות בחודש">
        {L.WEEKDAYS_SHORT.map((w) => <span key={w} className="cal-wd" aria-hidden="true">{w}</span>)}
        {Array.from({ length: mo.firstDow }, (_, i) => <span key={`b${i}`} aria-hidden="true" />)}
        {mo.days.map((d) => {
          const day = Number(d.date.slice(8));
          const logged = d.exp + d.inc;
          const cls = d.future ? 'is-future' : d.opened ? 'is-open' : 'is-missed';
          const label = `${day}: ${d.future ? 'עוד לא הגיע' : `${d.opened ? 'נכנסת' : 'לא נכנסת'}${logged ? `, ${d.exp ? `${d.exp} הוצאות` : ''}${d.exp && d.inc ? ' ו־' : ''}${d.inc ? `${d.inc} הכנסות` : ''}` : ', בלי רישומים'}`}`;
          return <span key={d.date} className={`scal-day ${cls}${d.today ? ' is-today' : ''}`} role="listitem" aria-label={label}>{day}{logged > 0 && !d.future && <i className="scal-dot" />}</span>;
        })}
      </div>
      <div className="scal-legend" aria-hidden="true"><span><i className="lg-open" />נכנסת</span><span><i className="lg-miss" />לא נכנסת</span><span><i className="lg-dot" />היו רישומים</span></div>
      <p className="block-p">{isCur ? 'החודש' : 'בחודש הזה'}: נכנסת {mo.opened} ימים, פספסת {mo.missed}{mo.empty ? `, ו־${mo.empty} ימים בלי אף רישום` : ''}.</p>
    </div>
  );
}
export function StreakSheet() {
  const { streakMonth, openStreak, closeStreak } = useOverlay();
  return (
    <Sheet open={!!streakMonth} onClose={closeStreak} labelledBy="streak-title">
      <div className="sheet-body">
        <div className="sheet-head">
          <h2 id="streak-title">הרצף שלך</h2>
          <button type="button" className="link" data-close>סגירה</button>
        </div>
        {streakMonth && <StreakCalendar monthKey={streakMonth} setMonth={openStreak} />}
      </div>
    </Sheet>
  );
}

/* ---------- per-page guide: most important first; the first `mandatory` steps can't be skipped ---------- */
function TourBody({ tour, end }) {
  const [list] = useState(() => tour.steps.filter((st) => document.querySelector(st.sel)));
  const [idx, setIdx] = useState(0);
  const [hole, setHole] = useState(null);
  const [cardPos, setCardPos] = useState({});
  const nextBtn = useRef(null);
  const root = useRef(null);
  const mandatory = Math.min(tour.mandatory ?? 3, list.length);

  useEffect(() => { if (!list.length) end(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const place = () => {
    const target = list[idx] && document.querySelector(list[idx].sel);
    if (!target) return;
    const r = target.getBoundingClientRect();
    const pad = 6;
    setHole({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
    const below = r.bottom + 16 + 170 < innerHeight;
    setCardPos(below ? { top: Math.max(12, r.bottom + 14) } : { bottom: Math.max(12, innerHeight - r.top + 14) });
  };
  useLayoutEffect(() => {
    const target = list[idx] && document.querySelector(list[idx].sel);
    if (!target) return undefined;
    target.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    const id = setTimeout(place, reduced() ? 0 : 300);
    nextBtn.current?.focus({ preventScroll: true });
    addEventListener('resize', place);
    return () => { clearTimeout(id); removeEventListener('resize', place); };
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!list.length) return null;
  const step = list[idx];
  const last = idx === list.length - 1;
  const next = () => (last ? end() : setIdx(idx + 1));
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (idx >= mandatory) end();
        }
        if (e.key === 'Tab') {
          // keep focus inside the guide
          e.preventDefault();
          const btns = [...root.current.querySelectorAll('button:not([hidden])')];
          btns[(btns.indexOf(document.activeElement) + 1) % btns.length]?.focus();
        }
      }}>
      <div className="tour-hole" style={hole || { top: -9999, left: -9999 }} />
      <div className="tour-card tour-in" key={idx} style={cardPos}>
        <p className="tour-step">{idx + 1} מתוך {list.length}{idx < mandatory ? ' · חשוב' : ''}</p>
        <h2 className="tour-title" id="tour-title">{step.title}</h2>
        <p className="tour-text">{step.text}</p>
        <div className="tour-actions">
          <button type="button" className="btn btn-gold btn-small" ref={nextBtn} onClick={next}>{last ? 'הבנתי' : 'הבא'}</button>
          {/* the most important steps can't be skipped */}
          <button type="button" className="link link-on-dark" hidden={idx < mandatory || last} onClick={end}>דילוג על ההמשך</button>
        </div>
      </div>
    </div>
  );
}
export function Tour() {
  const { tour, endTour } = useOverlay();
  const dispatch = useDispatch();
  if (!tour) return null;
  const end = () => {
    dispatch(D.markTourSeen(tour.key));
    endTour();
    window.scrollTo(0, 0);
  };
  return <TourBody key={tour.id} tour={tour} end={end} />;
}
