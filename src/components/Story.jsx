// The monthly story: a full-screen, tap-through walk over last month.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import * as L from '../lib/logic.js';
import { reduced, tick } from '../lib/fx.js';
import { D } from '../store/dataSlice.js';
import { U } from '../store/uiSlice.js';
import { Sheet } from './Sheet.jsx';
import { useOverlay } from './UiProvider.jsx';
import { useActions } from '../hooks/useActions.jsx';
import { useMoney } from '../hooks/useApp.js';
import { CountUp } from './ui.jsx';
import { Piggy } from './Piggy.jsx';

function Curve({ inv }) {
  // two curves over 20 years: just saving vs saving + growth
  const W = 300, H = 120;
  const pts = (rate) => Array.from({ length: 21 }, (_, y) => L.futureValue({ monthly: inv.monthly, years: y, annualRate: rate }));
  const grow = pts(inv.rate);
  const flat = pts(0);
  const max = grow[20];
  const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${(W - (i / 20) * W).toFixed(1)} ${(H - (v / max) * (H - 6)).toFixed(1)}`).join(' ');
  return (
    <svg className="st-curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="השוואה לאורך 20 שנה: הפקדה בלבד מול הפקדה עם תשואה שנתית ממוצעת של 6%">
      <path className="st-curve-flat" d={path(flat)} />
      <path className="st-curve-grow" d={path(grow)} />
    </svg>
  );
}

function slidesFor(st, ctx) {
  const { money, catName, goal, canMove, ciDue, onDeposit, onReport, onCheckIn, onClose } = ctx;
  const r = st.report;
  const monthName = L.cycleLabel(st.cycle);
  const N = ({ a, cls = '' }) => <CountUp a={a} className={cls} />;
  const out = [];
  out.push({
    key: 'cover',
    body: (
      <>
        <p className="st-kicker">{monthName}</p>
        <h2 className="st-title">החודש שלך<br />במספרים</h2>
        <div className="st-big"><N a={r.spent} /></div>
        <p className="st-sub">יצאו מהחשבון{r.count ? ` ב־${r.count} רישומים` : ''}.</p>
        {r.income ? (
          <div className="st-pair">
            <div><span className="st-l">נכנס</span><N a={r.income} /></div>
            <div><span className="st-l">{r.left >= 0 ? 'נשאר' : 'חסר'}</span><N a={Math.abs(r.left)} cls={r.left >= 0 ? 'st-up' : 'st-down'} /></div>
          </div>
        ) : <p className="st-note">בלי נתוני הכנסה לחודש הזה. בצ׳ק־אין הבא אפשר להוסיף.</p>}
      </>
    ),
  });
  if (st.top.length) {
    const max = st.top[0].amount;
    out.push({
      key: 'where',
      body: (
        <>
          <p className="st-kicker">לאן הלך הכסף</p>
          <h2 className="st-title">{st.top[0].cat.name}<br />במקום הראשון</h2>
          <ul className="st-bars">
            {st.top.map((t, i) => (
              <li key={t.cat.id} style={{ '--i': i }}>
                <span className="st-bar-l">{t.cat.name}</span>
                <span className="st-bar"><span style={{ '--w': `${((t.amount / max) * 100).toFixed(1)}%` }} /></span>
                <span className="st-bar-v">{money(t.amount, { round: true })} · {Math.round(t.share * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      ),
    });
  }
  if (st.biggest || st.topPlace) {
    out.push({
      key: 'highlights',
      body: (
        <>
          <p className="st-kicker">מה בלט</p>
          {st.biggest && (
            <div className="st-card" style={{ '--i': 0 }}>
              <span className="st-l">ההוצאה הכי גדולה</span>
              <strong>{st.biggest.note || catName(st.biggest.catId)}</strong>
              <span className="st-card-v"><N a={st.biggest.amount} /></span>
              <span className="st-l">{L.dayLabel(st.biggest.date)}</span>
            </div>
          )}
          {st.topPlace && (
            <div className="st-card" style={{ '--i': 1 }}>
              <span className="st-l">המקום שחזרת אליו הכי הרבה</span>
              <strong>{st.topPlace.name}</strong>
              <span className="st-card-v"><N a={st.topPlace.total} /></span>
              <span className="st-l">{st.topPlace.count} פעמים, ממוצע {money(st.topPlace.avg, { round: true })}</span>
            </div>
          )}
        </>
      ),
    });
  }
  out.push({
    key: 'good',
    body: (
      <>
        <p className="st-kicker">נקודות טובות</p>
        <h2 className="st-title">מה עבד</h2>
        {r.wins.length
          ? <ul className="st-list st-good">{r.wins.map((w, i) => <li key={w} style={{ '--i': i }}>{w}</li>)}</ul>
          : <p className="st-sub">החודש הראשון הוא נקודת הפתיחה. מהחודש הבא יהיה למה להשוות.</p>}
      </>
    ),
  });
  out.push({
    key: 'learn',
    body: (
      <>
        <p className="st-kicker">מה כדאי ללמוד</p>
        <h2 className="st-title">{r.tips.length ? 'כאן היה אפשר לחסוך' : 'חודש נקי'}</h2>
        {r.tips.length
          ? <ol className="st-list st-learn">{r.tips.slice(0, 3).map((t, i) => <li key={t.title} style={{ '--i': i }}><strong>{t.title}</strong><span>{t.detail}</span></li>)}</ol>
          : <p className="st-sub">לא נמצאו חריגות או הרגלים יקרים. ככה ממשיכים.</p>}
      </>
    ),
  });
  const inv = st.invest;
  if (inv.monthly > 0) {
    out.push({
      key: 'invest',
      body: (
        <>
          <p className="st-kicker">ואם היית משקיע במקום</p>
          <h2 className="st-title">{money(inv.monthly, { round: true })} בחודש<br />שלא היו יוצאים</h2>
          <div className="st-pair">
            <div><span className="st-l">אחרי 10 שנים</span><N a={inv.y10} /></div>
            <div><span className="st-l">אחרי 20 שנים</span><N a={inv.y20} /></div>
          </div>
          <Curve inv={inv} />
          <p className="st-legend"><span><i className="lg-grow" />עם תשואה</span><span><i className="lg-flat" />רק הפקדות ({money(inv.deposited10, { round: true })} ב־10 שנים)</span></p>
          <p className="st-note">הסכום החודשי מבוסס על מה שהיה אפשר לחסוך החודש. הנחת תשואה של {Math.round(inv.rate * 100)}% בשנה, לצורך המחשה בלבד. אין בזה הבטחה לתשואה, וזה לא ייעוץ השקעות.</p>
        </>
      ),
    });
  }
  if (st.nw) {
    const groups = L.ASSET_GROUPS.map((g) => ({ ...g, v: st.nw[g.key] || 0 }));
    const max = Math.max(1, ...groups.map((g) => g.v));
    out.push({
      key: 'wealth',
      body: (
        <>
          <p className="st-kicker">הכסף שלך · {L.monthLabelFromKey(st.nw.period)}</p>
          <div className="st-big"><N a={st.nw.total} /></div>
          {st.nwChange !== null && <p className={`st-sub ${st.nwChange >= 0 ? 'st-up' : 'st-down'}`}>{st.nwChange >= 0 ? 'עלה' : 'ירד'} ב־{money(Math.abs(st.nwChange), { round: true })} מהחודש הקודם</p>}
          <ul className="st-bars">
            {groups.map((g, i) => (
              <li key={g.key} style={{ '--i': i }}>
                <span className="st-bar-l">{g.label}</span>
                <span className="st-bar st-bar-gold"><span style={{ '--w': `${((g.v / max) * 100).toFixed(1)}%` }} /></span>
                <span className="st-bar-v">{money(g.v, { round: true })}</span>
              </li>
            ))}
          </ul>
        </>
      ),
    });
  }
  if (goal) {
    const ratio = goal.saved / goal.target;
    out.push({
      key: 'piggy',
      body: (
        <>
          <p className="st-kicker">קופת החיסכון</p>
          <h2 className="st-title">{goal.name}</h2>
          <div className="st-piggy"><Piggy level={ratio} label={`${Math.round(ratio * 100)} אחוז מהמטרה`} /></div>
          <p className="st-sub">{money(goal.saved, { round: true })} מתוך {money(goal.target, { round: true })}</p>
          {canMove > 0 && <button type="button" className="btn btn-gold st-cta" onClick={onDeposit}>להעביר {money(canMove, { round: true })} שנשארו לקופה</button>}
        </>
      ),
    });
  }
  out.push({
    key: 'end',
    body: (
      <>
        <p className="st-kicker">{monthName}</p>
        <h2 className="st-title">זהו.<br />חודש חדש מתחיל.</h2>
        <p className="st-sub">{r.tips[0] ? `המטרה לחודש הבא: ${r.tips[0].title}.` : 'ממשיכים באותו קצב.'}</p>
        <div className="st-actions">
          {ciDue && <button type="button" className="btn btn-gold" onClick={onCheckIn}>צ׳ק־אין לחודש החדש</button>}
          <button type="button" className="btn btn-line-dark" onClick={onReport}>לדוח המלא</button>
          <button type="button" className="link link-on-dark" onClick={onClose}>סגירה</button>
        </div>
      </>
    ),
  });
  return out;
}

function StoryBody({ cycle, close }) {
  const store = useStore();
  const dispatch = useDispatch();
  const money = useMoney();
  const act = useActions();
  const goals = useSelector((s) => s.data.goals);
  const t = L.todayISO();
  // the story is a snapshot of the month taken when it opens
  const st = useMemo(() => L.monthStory(store.getState().data, cycle, t), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [moved, setMoved] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const stageRef = useRef(null);
  const nextRef = useRef(null);
  useEffect(() => {
    dispatch(D.setSetting({ key: 'lastStorySeen', value: cycle.start }));
    nextRef.current?.focus({ preventScroll: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goal = st.goal ? goals.find((g) => g.id === st.goal.id) || st.goal : null;
  const room = goal ? Math.max(0, goal.target - goal.saved) : 0;
  const canMove = !moved && st.report.left > 0 && room > 0 ? Math.min(st.report.left, room) : 0;
  const slides = slidesFor(st, {
    money,
    catName: act.catName,
    goal,
    canMove,
    ciDue: L.checkInStatus(store.getState().data, t).due,
    onDeposit: () => {
      if (act.depositToGoal(goal.id, canMove, stageRef.current?.querySelector('.piggy-slot'))) setMoved(true);
    },
    onReport: () => { close(); dispatch(U.openSub({ sub: 'report', reportStart: cycle.start })); window.scrollTo(0, 0); },
    onCheckIn: () => { close(); setTimeout(() => act.openCheckIn(), 50); },
    onClose: close,
  });
  const show = (i, d) => {
    setDir(d);
    setIdx(Math.max(0, Math.min(slides.length - 1, i)));
    tick(8);
  };
  const next = () => (idx < slides.length - 1 ? show(idx + 1, 1) : close());
  const prev = () => idx > 0 && show(idx - 1, -1);
  const s = slides[idx];
  const sx = useRef(null);

  return (
    <div className="story-wrap" onKeyDown={(e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); next(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); prev(); }
    }}>
      <div className="story-top">
        <div className="story-bars" aria-hidden="true">
          {slides.map((x, k) => <span key={x.key} className={k < idx ? 'done' : k === idx ? 'now' : ''} />)}
        </div>
        <button type="button" className="story-x" aria-label="סגירת הסיכום" onClick={close}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div ref={stageRef} key={s.key}
        className={`story-stage st-${s.key} ${reduced() ? '' : dir > 0 ? 'st-in-next' : 'st-in-prev'}`}
        aria-live="polite" aria-label={`שקופית ${idx + 1} מתוך ${slides.length}`}
        onClick={(ev) => {
          // tap zones: in RTL, the left side moves forward
          if (ev.target.closest('button, a')) return;
          const r = ev.currentTarget.getBoundingClientRect();
          if (ev.clientX < r.left + r.width / 2) next();
          else prev();
        }}
        onTouchStart={(e) => { sx.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (sx.current === null) return;
          const dx = e.changedTouches[0].clientX - sx.current;
          sx.current = null;
          if (Math.abs(dx) > 50) (dx < 0 ? next : prev)(); // swipe left = forward (RTL)
        }}>
        <div className="st-inner">{s.body}</div>
      </div>
      <div className="story-nav">
        <button type="button" className="btn btn-gold" ref={nextRef} onClick={next}>{idx === slides.length - 1 ? 'סיום' : 'הבא'}</button>
        <button type="button" className="link link-on-dark" disabled={idx === 0} onClick={prev}>הקודם</button>
      </div>
    </div>
  );
}

export function Story() {
  const { story, closeStory } = useOverlay();
  return (
    <Sheet open={!!story} onClose={closeStory} className="story" label="הסיכום החודשי" closeOnBackdrop={false}>
      {story && <StoryBody key={story.start} cycle={story} close={closeStory} />}
    </Sheet>
  );
}
