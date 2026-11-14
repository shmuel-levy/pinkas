// Tap any date (ledger calendar, no-spend calendar, streak calendar) and see everything about that day.
import { useSelector } from 'react-redux';
import * as L from '../lib/logic.js';
import { dayDetails } from '../lib/personal.js';
import { Sheet } from '../components/Sheet.jsx';
import { useOverlay } from '../components/UiProvider.jsx';
import { useMoney, useCatById } from '../hooks/useApp.js';
import { Dot, M } from '../components/ui.jsx';
import { ExpenseRow, IncomeRow } from '../components/Rows.jsx';
import { Tip } from '../components/Tip.jsx';

function Verdict({ d }) {
  const money = useMoney();
  if (d.future) {
    return <p className="day-verdict">היום הזה עוד לא הגיע.{d.upcoming.length ? ' אלה החיובים שמתוכננים בו:' : ' עוד אין בו חיובים מתוכננים.'}</p>;
  }
  if (d.noSpend) {
    return (
      <p className="day-verdict is-good">
        <strong>{d.isToday ? 'עד עכשיו — יום בלי הוצאות.' : 'יום בלי הוצאות.'}</strong>{' '}
        {d.isToday ? 'אם זה יישאר ככה, הוא ייצבע בירוק.' : 'ימים כאלה הם מה שבונה חיסכון.'}
      </p>
    );
  }
  if (d.vsShare === null) return null;
  return d.vsShare <= 0
    ? <p className="day-verdict is-good">מתחת לחלק היומי של התקציב ({money(d.dailyShare, { round: true })}) ב־<M a={-d.vsShare} round />.</p>
    : <p className="day-verdict is-warn">מעל החלק היומי של התקציב ({money(d.dailyShare, { round: true })}) ב־<M a={d.vsShare} round />. קורה — העיקר לאזן בימים הבאים.</p>;
}

function DayBody({ date, setDate }) {
  const state = useSelector((s) => s.data);
  const catById = useCatById();
  const { openAdd } = useOverlay();
  const t = L.todayISO();
  const d = dayDetails(state, date, t);
  const dd = L.fromISO(date);
  const sameYear = dd.getFullYear() === L.fromISO(t).getFullYear();
  const title = `יום ${L.WEEKDAYS[dd.getDay()]}, ${dd.getDate()} ב${L.MONTHS[dd.getMonth()]}${sameYear ? '' : ` ${dd.getFullYear()}`}`;
  const diff = L.dayDiff(date, t); // days from that date to today
  const rel = diff === 0 ? 'היום' : diff === 1 ? 'אתמול' : diff === -1 ? 'מחר' : diff > 0 ? `לפני ${diff} ימים` : `בעוד ${-diff} ימים`;
  const count = d.expenses.length + d.incomes.length;

  return (
    <div className="sheet-body day-sheet">
      <div className="sheet-head">
        <h2 id="day-title">{title}</h2>
        <button type="button" className="link" data-close>סגירה</button>
      </div>
      <div className="day-nav">
        <button type="button" aria-label="ליום הקודם" onClick={() => setDate(L.addDays(date, -1))}>→</button>
        <span className="day-rel" id="day-rel">{rel}</span>
        <button type="button" aria-label="ליום הבא" onClick={() => setDate(L.addDays(date, 1))}>←</button>
      </div>

      {!d.future && (d.spent > 0 || d.income > 0) && (
        <dl className="ledger-sum day-sum">
          <div><dt>הוצאות</dt><dd><M a={d.spent} round /></dd></div>
          <div><dt>הכנסות</dt><dd className="pos"><M a={d.income} round /></dd></div>
          {d.income > 0
            ? <div><dt>{d.net < 0 ? 'יצא יותר' : 'נשאר'}</dt><dd className={d.net < 0 ? 'neg' : ''}><M a={Math.abs(d.net)} round /></dd></div>
            : <div><dt>חלק יומי</dt><dd>{d.dailyShare ? <M a={d.dailyShare} round /> : '—'}</dd></div>}
        </dl>
      )}
      <Verdict d={d} />
      <Tip id="day" title="מה רואים כאן">כל מה שקרה ביום הזה: הוצאות, הכנסות, חיובים קבועים וויתורים. לחיצה על שורה פותחת אותה לעריכה.</Tip>

      {d.byCat.length > 1 && (
        <section className="day-block" aria-labelledby="day-cats">
          <h3 className="day-h" id="day-cats">לאן הלך הכסף</h3>
          <ul className="shares">
            {d.byCat.map((x) => (
              <li key={x.cat.id}>
                <span className="sh-name"><Dot color={x.cat.color} />{x.cat.name}</span>
                <span className="sh-bar" aria-hidden="true"><span style={{ width: `${((x.amount / d.byCat[0].amount) * 100).toFixed(1)}%` }} /></span>
                <span className="sh-val"><M a={x.amount} round /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {count > 0 && (
        <section className="day-block" aria-labelledby="day-list">
          <h3 className="day-h" id="day-list">{count === 1 ? 'רישום אחד' : `${count} רישומים`}</h3>
          <ul className="rows">
            {d.incomes.map((i) => <IncomeRow key={i.id} i={i} t={t} />)}
            {d.expenses.map((e) => <ExpenseRow key={e.id} e={e} t={t} />)}
          </ul>
        </section>
      )}

      {d.upcoming.length > 0 && (
        <section className="day-block" aria-labelledby="day-up">
          <h3 className="day-h" id="day-up">חיובים קבועים שיירשמו ביום הזה</h3>
          <ul className="kv">
            {d.upcoming.map((u) => <li key={u.item.id}><span>{u.item.name} <span className="small muted">· {catById(u.item.catId)?.name || ''}</span></span><M a={u.item.amount} /></li>)}
          </ul>
        </section>
      )}

      {d.resisted.length > 0 && (
        <section className="day-block" aria-labelledby="day-res">
          <h3 className="day-h" id="day-res">ויתרת על</h3>
          <ul className="kv">
            {d.resisted.map((r) => <li key={r.id}><span>{r.name || 'ויתור'}</span><span className="pos"><M a={r.amount} /></span></li>)}
          </ul>
          <p className="small muted">כסף שנשאר אצלך בזכות החלטה טובה.</p>
        </section>
      )}

      {!count && !d.future && !d.upcoming.length && (
        <p className="block-p">{d.resisted.length ? 'מלבד הוויתור, לא נרשם כלום ביום הזה.' : 'ביום הזה לא נרשם כלום.'} שכחת משהו? אפשר להוסיף עכשיו, והוא יירשם בתאריך הזה.</p>
      )}
      {!d.future && d.opened && <p className="small muted day-opened">נכנסת לשקל בצד ביום הזה — הוא נספר ברצף שלך.</p>}

      <div className="sheet-actions">
        {!d.future && <button type="button" className="btn btn-primary" onClick={() => openAdd({ date })}>להוסיף הוצאה ליום הזה</button>}
        {!d.future && <button type="button" className="btn btn-line" onClick={() => openAdd({ date, kind: 'income' })}>להוסיף הכנסה</button>}
      </div>
    </div>
  );
}

export function DaySheet() {
  const { day, openDay, closeDay } = useOverlay();
  return (
    <Sheet open={!!day} onClose={closeDay} labelledBy="day-title day-rel">
      {day && <DayBody date={day} setDate={(d) => d <= L.addDays(L.todayISO(), 60) && openDay(d)} />}
    </Sheet>
  );
}
