// סיכום חודשי: income vs spending for one cycle, what to improve, what went well, net-worth change.
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import * as L from '../lib/logic.js';
import { useData, useUi, today } from '../hooks/useApp.js';
import { useActions } from '../hooks/useActions.jsx';
import { D } from '../store/dataSlice.js';
import { useOverlay } from '../components/UiProvider.jsx';
import { Dot, M } from '../components/ui.jsx';
import { Tips } from './InsightsPage.jsx';

// the check-in month whose check-in date falls inside a cycle
export function periodForCycle(state, cycle) {
  const day = String(state.settings.checkInDay).padStart(2, '0');
  const k = L.monthKey(cycle.start);
  for (const key of [k, L.nextMonthKey(k)]) if (L.inCycle(`${key}-${day}`, cycle)) return key;
  return k;
}

export function ReportPage() {
  const state = useData();
  const { reportStart } = useUi();
  const dispatch = useDispatch();
  const act = useActions();
  const { openStory } = useOverlay();
  const t = today();
  const c = L.cycleFor(reportStart || t, state.settings.cycleDay);
  const r = L.monthlyReport(state, c, t);
  const maxBar = Math.max(r.income, r.spent, 1);
  const pct = (v) => `${((v / maxBar) * 100).toFixed(1)}%`;
  const period = periodForCycle(state, c);

  // opening the pending report marks it as seen
  useEffect(() => {
    const pend = L.pendingReport(state, t);
    if (pend && pend.start === c.start) dispatch(D.setSetting({ key: 'lastReportSeen', value: c.start }));
  }, [c.start]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <section className="vault report-head" aria-labelledby="rep-title">
        <p className="vault-label" id="rep-title">{L.cycleLabel(c)}{r.complete ? '' : ' · עדיין לא נגמר'}</p>
        {r.income ? (
          <>
            <p className="eyebrow">{r.left >= 0 ? 'נשאר בסוף החודש' : 'חסר בסוף החודש'}</p>
            <p className={`hero-num ${r.left < 0 ? 'neg' : ''}`}><M a={Math.abs(r.left)} round /></p>
            <p className="hero-sub">{r.left >= 0 ? <>שיעור חיסכון: <strong>{Math.round(r.rate * 100)}%</strong> מההכנסה.</> : 'ההוצאות עברו את ההכנסה.'}</p>
          </>
        ) : (
          <>
            <p className="eyebrow">הוצאות במחזור</p>
            <p className="hero-num"><M a={r.spent} round /></p>
            <p className="hero-sub">לא הוזנה הכנסה לחודש הזה, אז אין השוואה. <button type="button" className="link link-on-dark" onClick={() => act.openCheckIn(period)}>להזין הכנסה</button></p>
          </>
        )}
        {r.complete && r.count > 0 && <button type="button" className="btn btn-gold btn-small rep-story" onClick={() => openStory(c)}>לצפות בסיכום כמסע</button>}
      </section>

      <section aria-labelledby="ie-h">
        <div className="sec-head"><h2 className="sec-title" id="ie-h">הכנסות מול הוצאות</h2>{r.income > 0 && <button type="button" className="link" onClick={() => act.openCheckIn(period)}>עריכה</button>}</div>
        <ul className="ie">
          <li className="ie-row"><span className="ie-l">הכנסות</span><span className="ie-v"><M a={r.income} round /></span><span className="ie-bar" aria-hidden="true"><span className="ie-in" style={{ width: pct(r.income) }} /></span></li>
          <li className="ie-row"><span className="ie-l">הוצאות</span><span className="ie-v"><M a={r.spent} round /></span><span className="ie-bar" aria-hidden="true"><span className="ie-fixed" style={{ width: pct(r.fixed) }} /><span className="ie-var" style={{ width: pct(r.variable) }} /></span></li>
        </ul>
        {r.incomeSource === 'setting' && <p className="small muted">אין צ׳ק־אין לחודש הזה, אז ההכנסה לקוחה מההגדרות.</p>}
        {r.incomeSource === 'entries' && <p className="small muted">לפי ההכנסות שרשמת במחזור.</p>}
        <p className="small muted ie-legend">
          <span><i className="ie-fixed" aria-hidden="true" />קבועות <M a={r.fixed} round /></span>
          <span><i className="ie-var" aria-hidden="true" />משתנות <M a={r.variable} round /></span>
        </p>
        {r.prevSpent > 0 && (
          <p className="block-p">
            {r.delta > 0 ? <>הוצאת <strong className="neg"><M a={r.delta} round /> יותר</strong></> : r.delta < 0 ? <>הוצאת <strong className="pos"><M a={-r.delta} round /> פחות</strong></> : 'הוצאת בדיוק כמו'}
            {' '}לעומת המחזור הקודם (<M a={r.prevSpent} round />).
          </p>
        )}
      </section>

      <section className="section-gap" aria-labelledby="imp-h">
        <div className="sec-head"><h2 className="sec-title" id="imp-h">איפה אפשר להשתפר</h2></div>
        {r.tips.length ? <Tips tips={r.tips} /> : <p className="block-p">חודש נקי: לא נמצאו חריגות או הרגלים יקרים. ככה ממשיכים.</p>}
      </section>

      {r.wins.length > 0 && (
        <section className="section-gap" aria-labelledby="win-h">
          <div className="sec-head"><h2 className="sec-title" id="win-h">מה הלך טוב</h2></div>
          <ul className="wins">{r.wins.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      )}

      {r.startSnap && (() => {
        const ga = L.groupTotals(r.startSnap);
        const gb = r.endSnap ? L.groupTotals(r.endSnap) : null;
        return (
          <section className="section-gap" aria-labelledby="nwr-h">
            <div className="sec-head"><h2 className="sec-title" id="nwr-h">השווי שלך</h2></div>
            <table className="cmp">
              <thead><tr><th scope="col"><span className="sr-only">סוג</span></th><th scope="col">בתחילה</th><th scope="col">{r.endSnap ? 'אחרי' : 'עכשיו'}</th><th scope="col">שינוי</th></tr></thead>
              <tbody>
                {L.ASSET_GROUPS.map(({ label, key }) => {
                  const a = ga[key] || 0;
                  const b = gb ? gb[key] || 0 : null;
                  const same = b === null || b === a;
                  return (
                    <tr key={key}>
                      <th scope="row" style={{ fontWeight: 500, textAlign: 'start' }}>{label}</th>
                      <td><M a={a} round /></td>
                      <td>{b === null ? '—' : <M a={b} round />}</td>
                      <td className={same ? 'muted' : b > a ? 'pos' : 'neg'}>{same ? '—' : <M a={b - a} round signed />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!r.endSnap && <p className="small muted">השינוי יופיע אחרי הצ׳ק־אין של החודש הבא.</p>}
          </section>
        );
      })()}

      <section className="section-gap" aria-labelledby="rc-h">
        <div className="sec-head"><h2 className="sec-title" id="rc-h">לפי קטגוריה</h2></div>
        <table className="cmp">
          <thead><tr><th scope="col">קטגוריה</th><th scope="col">הוצאה</th><th scope="col">תקציב</th></tr></thead>
          <tbody>
            {r.byCat.map((x) => (
              <tr key={x.cat.id}>
                <th scope="row" style={{ fontWeight: 500, textAlign: 'start' }}><Dot color={x.cat.color} /> {x.cat.name}</th>
                <td className={x.over ? 'neg' : ''}><M a={x.spent} round /></td>
                <td className="muted">{x.budget ? <M a={x.budget} round /> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
