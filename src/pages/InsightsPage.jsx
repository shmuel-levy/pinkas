// תובנות: where to improve, where the money went, past months, places, a 6-cycle chart, comparisons.
import { useDispatch } from 'react-redux';
import * as L from '../lib/logic.js';
import { useData, useMoney, today } from '../hooks/useApp.js';
import { useActions } from '../hooks/useActions.jsx';
import { U } from '../store/uiSlice.js';
import { useOverlay } from '../components/UiProvider.jsx';
import { Dot, M } from '../components/ui.jsx';

export function Tips({ tips }) {
  return (
    <ol className="tips">
      {tips.map((tp) => (
        <li key={tp.title}>
          <p className="tip-title">{tp.title}</p>
          <p className="tip-detail">{tp.detail}</p>
          <p className="tip-save">פוטנציאל: עד <M a={tp.saving} round /> בחודש</p>
        </li>
      ))}
    </ol>
  );
}

function CycleChart({ totals, budget, cur }) {
  const money = useMoney();
  const compact = (a) => {
    const v = Math.round(a / 100);
    return v >= 1000 ? cur + (v / 1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K' : cur + v;
  };
  const W = 340, H = 170, pad = 24, gap = 12;
  const maxV = Math.max(budget || 0, ...totals.map((x) => x.total), 1);
  const bw = (W - gap * (totals.length - 1)) / totals.length;
  const y = (v) => H - pad - (v / maxV) * (H - pad * 2);
  const ordered = [...totals].reverse(); // index 0 = newest -> leftmost
  const desc = totals.map((x) => `${L.cycleLabel(x.cycle)}: ${money(x.total, { round: true })}`).join('; ');
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 -8 ${W} ${H + 8}`} role="img" aria-label={`סך ההוצאות לפי מחזור. ${desc}`}>
        {budget > 0 && (
          <>
            <line className="budget-line" x1="0" x2={W} y1={y(budget).toFixed(1)} y2={y(budget).toFixed(1)} />
            <text className="budget-label" x={W - 2} y={(y(budget) - 4).toFixed(1)} textAnchor="end">תקציב {compact(budget)}</text>
          </>
        )}
        {ordered.map((x, i) => {
          const bx = i * (bw + gap);
          const by = y(x.total);
          return (
            <g key={x.cycle.start}>
              <rect className={`b ${x.current ? 'cur' : ''}`} x={bx.toFixed(1)} y={by.toFixed(1)} width={bw.toFixed(1)} height={(H - pad - by).toFixed(1)} rx="2" />
              <text className="val" x={(bx + bw / 2).toFixed(1)} y={(by - 6).toFixed(1)} textAnchor="middle">{compact(x.total)}</text>
              <text x={(bx + bw / 2).toFixed(1)} y={H - 6} textAnchor="middle">{L.shortCycleLabel(x.cycle)}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="small muted">{budget ? 'הקו המקווקו — התקציב החודשי. ' : ''}המחזור הנוכחי בצבע מלא{totals[totals.length - 1].current ? ' (עדיין לא נגמר)' : ''}.</figcaption>
    </figure>
  );
}

export function InsightsPage() {
  const state = useData();
  const dispatch = useDispatch();
  const money = useMoney();
  const act = useActions();
  const { openAdd } = useOverlay();
  const t = today();
  const settings = () => dispatch(U.openSub({ sub: 'settings' }));
  const report = (start) => dispatch(U.openSub({ sub: 'report', reportStart: start }));

  if (!state.expenses.length) {
    return (
      <section className="empty">
        <h2>אין עדיין מה לנתח</h2>
        <p>אחרי שבוע־שבועיים של רישום יופיעו כאן השוואות, הימים היקרים בשבוע, וכמה עולים המנויים בשנה.</p>
        <button type="button" className="btn btn-primary" onClick={() => openAdd()}>לרשום הוצאה</button>
      </section>
    );
  }

  const totals = L.cycleTotals(state, t, 6);
  const budget = state.settings.monthlyBudget || 0; // only an explicit total is comparable to all spending
  const cyc = L.cycleFor(t, state.settings.cycleDay);
  const tips = L.improvementTips(state, cyc, t, 3);
  const shares = L.categoryShares(state, cyc);
  const reports = [];
  for (let i = 1; i <= 12 && reports.length < 6; i++) {
    const c = L.shiftCycle(cyc, -i);
    const spent = L.sumBy(L.expensesInCycle(state.expenses, c));
    if (spent) reports.push({ c, spent, inc: L.incomeForCycle(state, c).amount });
  }
  const places = L.learnPlaces(L.expensesInCycle(state.expenses, cyc), state.placePrefs).sort((a, b) => b.total - a.total).slice(0, 5);
  const cmp = L.categoryCompare(state, t);
  const wd = L.weekdayPattern(state.expenses.filter((e) => e.date >= L.shiftCycle(cyc, -2).start));
  const wdMax = Math.max(...wd.map((d) => d.total), 1);
  const top = wd.reduce((a, b) => (b.total > a.total ? b : a), wd[0]);
  const st = L.spreadTotals(state.spreads, t);
  const rt = L.recurringTotals(state.recurring);
  const income = L.incomeForCycle(state, cyc).amount;

  return (
    <>
      <section aria-labelledby="tips-h">
        <div className="sec-head"><h2 className="sec-title" id="tips-h">איפה אפשר להשתפר</h2><span className="small muted">המחזור הנוכחי</span></div>
        {tips.length ? <Tips tips={tips} /> : <p className="block-p">בינתיים אין כאן מה לתקן. ההוצאות בקצב טוב.</p>}
      </section>

      {shares.length > 0 && (
        <section className="section-gap" aria-labelledby="sh-h">
          <div className="sec-head"><h2 className="sec-title" id="sh-h">לאן הלך הכסף</h2><span className="small muted">המחזור הנוכחי</span></div>
          <ul className="shares">
            {shares.map((r) => (
              <li key={r.cat.id}>
                <span className="sh-name"><Dot color={r.cat.color} />{r.cat.name}</span>
                <span className="sh-bar" aria-hidden="true"><span style={{ width: `${((r.amount / shares[0].amount) * 100).toFixed(1)}%` }} /></span>
                <span className="sh-val"><M a={r.amount} round /> <span className="muted">{Math.round(r.share * 100)}%</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reports.length > 0 && (
        <section className="section-gap" aria-labelledby="rep-h">
          <div className="sec-head"><h2 className="sec-title" id="rep-h">סיכומים חודשיים</h2></div>
          <ul className="rows report-list">
            {reports.map(({ c, spent, inc }) => (
              <li key={c.start}>
                <button type="button" className="row-btn" onClick={() => report(c.start)}>
                  <span className="row-main">
                    <span className="row-title">{L.cycleLabel(c)}</span>
                    <span className="row-sub">{inc ? `הכנסות ${money(inc, { round: true })} · ${inc - spent >= 0 ? 'נשאר' : 'חסר'} ${money(Math.abs(inc - spent), { round: true })}` : 'בלי נתוני הכנסה'}</span>
                  </span>
                  <span className="row-amt"><M a={spent} round /></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {places.length > 0 && (
        <section className="section-gap" aria-labelledby="pl-h">
          <div className="sec-head"><h2 className="sec-title" id="pl-h">המקומות שלך</h2><span className="small muted">המחזור הנוכחי</span></div>
          <ul className="kv">
            {places.map((p) => <li key={p.key}><span>{p.name} <span className="small muted">· {p.count} פעמים · ממוצע {money(p.avg, { round: true })}</span></span><M a={p.total} round /></li>)}
          </ul>
        </section>
      )}

      <section className="section-gap" aria-labelledby="ch-h">
        <div className="sec-head"><h2 className="sec-title" id="ch-h">שישה מחזורים אחרונים</h2></div>
        <CycleChart totals={totals} budget={budget} cur={state.settings.currency} />
      </section>

      {cmp.length > 0 && (
        <section className="section-gap" aria-labelledby="cmp-h">
          <div className="sec-head"><h2 className="sec-title" id="cmp-h">מול המחזור הקודם</h2></div>
          <p className="block-p">השוואה הוגנת: מול אותה נקודת זמן במחזור הקודם.</p>
          <table className="cmp">
            <thead><tr><th scope="col">קטגוריה</th><th scope="col">עכשיו</th><th scope="col">אז</th><th scope="col">הפרש</th></tr></thead>
            <tbody>
              {cmp.map((r) => (
                <tr key={r.cat.id}>
                  <th scope="row" style={{ fontWeight: 500, textAlign: 'start' }}><Dot color={r.cat.color} /> {r.cat.name}</th>
                  <td><M a={r.now} round /></td>
                  <td className="muted"><M a={r.before} round /></td>
                  <td className={r.delta > 0 ? 'neg' : r.delta < 0 ? 'pos' : 'muted'}>{r.delta ? <M a={r.delta} round signed /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {top.total > 0 && (
        <section aria-labelledby="wd-h">
          <div className="sec-head"><h2 className="sec-title" id="wd-h">ימים יקרים</h2></div>
          <p className="block-p">ביום {L.WEEKDAYS[top.day]} הולך הכי הרבה כסף (שלושה מחזורים אחרונים, בלי חיובים קבועים). שווה לתכנן אותו מראש.</p>
          <ul className="wd">
            {wd.map((d) => (
              <li key={d.day} className={d.day === top.day ? 'is-top' : ''}>
                <span>{L.WEEKDAYS[d.day]}</span>
                <div className="bar" aria-hidden="true"><span className="bar-fill" style={{ width: `${((d.total / wdMax) * 100).toFixed(1)}%` }} /></div>
                <M a={d.total} round />
              </li>
            ))}
          </ul>
        </section>
      )}

      {st.count > 0 && (
        <section aria-labelledby="sp-h">
          <div className="sec-head"><h2 className="sec-title" id="sp-h">ביטוחים ושנתיות</h2><button type="button" className="link" onClick={settings}>ניהול</button></div>
          <p className="callout">{st.count === 1 ? 'הוצאה שנתית אחת פרוסה' : `${st.count} הוצאות שנתיות פרוסות`} על החודשים: <M a={st.monthly} round /> בכל חודש, <M a={st.yearly} round /> בשנה.</p>
        </section>
      )}

      <section aria-labelledby="fx-h">
        <div className="sec-head"><h2 className="sec-title" id="fx-h">הוצאות קבועות</h2><button type="button" className="link" onClick={settings}>ניהול</button></div>
        {rt.count ? (
          <>
            <p className="callout">{rt.count} חיובים קבועים עולים <M a={rt.monthly} round /> בחודש — <strong><M a={rt.yearly} round /> בשנה</strong>. מנוי שלא השתמשת בו החודש? זה הזמן לבטל.</p>
            <ul className="kv">
              {state.recurring.filter((r) => r.active).sort((a, b) => b.amount - a.amount).map((r) => (
                <li key={r.id}><span>{r.name} <span className="small muted">· כל {r.day} בחודש</span></span><span><M a={r.amount} /> <span className="small muted">· {money(r.amount * 12, { round: true })} בשנה</span></span></li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="block-p">שכירות, מנויים, ביטוחים — מגדירים פעם אחת והם נרשמים לבד כל חודש, ונשמר להם מקום בתקציב.</p>
            <button type="button" className="btn btn-line btn-small" onClick={() => act.openRecurring()}>הוספת הוצאה קבועה</button>
          </>
        )}
      </section>

      {income > 0 && (() => {
        const spent = L.sumBy(L.expensesInCycle(state.expenses, cyc));
        const reserved = L.upcomingRecurring(state.recurring, cyc, t).reduce((s, u) => s + u.item.amount, 0);
        const left = income - spent - reserved;
        return (
          <section className="section-gap" aria-labelledby="inc-h">
            <div className="sec-head"><h2 className="sec-title" id="inc-h">הכנסה מול הוצאה</h2><button type="button" className="link" onClick={() => report(cyc.start)}>דוח מלא</button></div>
            <ul className="kv">
              <li><span>הכנסה החודש</span><M a={income} round /></li>
              <li><span>הוצאת עד עכשיו</span><M a={spent} round /></li>
              {reserved > 0 && <li><span>חיובים קבועים שעוד יגיעו</span><M a={reserved} round /></li>}
              <li><strong>נשאר</strong><strong className={left < 0 ? 'neg' : ''}><M a={left} round /> <span className="small">({Math.round((left / income) * 100)}%)</span></strong></li>
            </ul>
          </section>
        );
      })()}
    </>
  );
}
