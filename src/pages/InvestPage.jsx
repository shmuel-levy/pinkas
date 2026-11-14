// השקעות: where you stand → a short questionnaire → a tailored page (fees by broker, your bank, pension fees).
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import * as L from '../lib/logic.js';
import * as I from '../lib/invest.js';
import { useData, useUi, useMoney, today } from '../hooks/useApp.js';
import { useActions } from '../hooks/useActions.jsx';
import { D } from '../store/dataSlice.js';
import { U } from '../store/uiSlice.js';
import { useOverlay } from '../components/UiProvider.jsx';
import { M } from '../components/ui.jsx';
import { Tip } from '../components/Tip.jsx';

const STATUS = [
  { key: 'investing', label: 'כבר יש לי השקעות', sub: 'תיק, גמל להשקעה או קרן השתלמות' },
  { key: 'invested', label: 'השקעתי בעבר', sub: 'ורוצה לחזור בצורה מסודרת' },
  { key: 'want', label: 'רוצה להתחיל להשקיע', sub: 'ולא בטוח/ה מאיפה' },
];
const WHY = {
  broker: 'כדי להשוות את העלות אצלך מול האפשרויות האחרות.',
  horizon: 'ככל שהזמן ארוך יותר, יש יותר זמן להתאושש מירידות בשוק — וזה משנה מה מתאים.',
  goal: 'כרית ביטחון ודירה צריכות כסף זמין. פרישה יכולה לחכות שנים.',
  money: 'העמלות תלויות בגודל ההפקדות. אפשר גם 0 בחד־פעמי ולהתחיל רק בהפקדה חודשית.',
  market: 'זה קובע באיזה מטבע קונים ואילו בתי השקעות בכלל מציעים את זה.',
};
const steps = (status) => [...(status === 'investing' ? ['broker'] : []), 'horizon', 'goal', 'money', 'market'];
const lastSnap = (state) => {
  const series = L.netWorthSeries(state.snapshots);
  return series[series.length - 1] || null;
};

function Options({ name, options, current, onPick }) {
  return (
    <div className="inv-options" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={o.key} type="button" className="inv-option" role="radio" aria-checked={current === o.key} onClick={() => onPick(o.key)}>
          <span className="inv-option-l">{o.label}</span>{o.sub && <span className="inv-option-s">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

function MarketCards({ current, onPick }) {
  const card = (key) => {
    const ex = I.MARKET_EXAMPLES[key];
    return (
      <button key={key} type="button" className="inv-option inv-market" role="radio" aria-checked={current === key} onClick={() => onPick(key)}>
        <span className="inv-mk-top"><span className="inv-mk-flag" aria-hidden="true">{key === 'us' ? 'USD' : 'ILS'}</span><span className="inv-option-l">{ex.title}</span></span>
        <span className="inv-option-s">{ex.what}</span>
        <span className="inv-mk-list">
          {ex.items.map((it) => <span className="inv-mk-item" key={it.tag}><span className="ticker">{it.tag}</span><span><strong>{it.name}</strong> — {it.text}</span></span>)}
        </span>
      </button>
    );
  };
  return (
    <>
      <div className="inv-options" role="radiogroup" aria-label="איפה לקנות">
        {card('us')}{card('ta')}
        <button type="button" className="inv-option" role="radio" aria-checked={current === 'unsure'} onClick={() => onPick('unsure')}>
          <span className="inv-option-l">עוד לא יודע/ת</span><span className="inv-option-s">נחשב לפי תל אביב — שם אפשר גם לקנות S&amp;P 500 בשקלים.</span>
        </button>
      </div>
      <p className="small muted">הדוגמאות נועדו להבין במה מדובר. הן לא המלצה לקנות נייר ערך מסוים.</p>
    </>
  );
}

const Glossary = () => (
  <section className="section-gap" aria-labelledby="gl-h">
    <div className="sec-head"><h2 className="sec-title" id="gl-h">מילון קצר</h2></div>
    <div className="glossary">{I.GLOSSARY.map(([t, d]) => <details key={t}><summary>{t}</summary><p>{d}</p></details>)}</div>
  </section>
);
const Disclaimer = () => (
  <p className="inv-disclaimer">המידע כאן כללי ונועד לעזור להבין עלויות ואפשרויות. הוא לא ייעוץ השקעות, לא שיווק השקעות ולא תחליף לייעוץ מבעל רישיון שמתחשב בכל הנתונים שלך.</p>
);

function Question({ state, q, setQ, pick, advance, wipe }) {
  const dispatch = useDispatch();
  const money = useMoney();
  const list = steps(state.invest.status);
  const key = list[q.step];
  const d = q.draft;
  const [lump, setLump] = useState(d.lump ? String(d.lump / 100) : '');
  const [monthly, setMonthly] = useState(d.monthly ? String(d.monthly / 100) : '');
  const [error, setError] = useState('');
  const back = () => {
    if (q.step > 0) setQ({ step: q.step - 1 });
    else if (state.invest.profile) setQ({ active: false });
    else {
      dispatch(D.setInvest({ status: null }));
      setQ({ active: false });
    }
    window.scrollTo(0, 0);
  };
  const monthlyHint = (() => {
    const r = L.monthlyReport(state, L.lastFinishedCycle(state, today()), today());
    return r.income && r.left > 0 ? `בחודש שעבר נשארו לך ${money(r.left, { round: true })}.` : 'גם ₪200 בחודש זה התחלה.';
  })();
  let title = '';
  let body = null;
  if (key === 'broker') {
    title = 'איפה התיק שלך היום?';
    const myBank = L.bankName(state.settings.bank);
    body = <Options name="בית ההשקעות" current={d.broker} onPick={pick}
      options={[...I.BROKERS.filter((b) => b.kind !== 'bank').map((b) => ({ key: b.id, label: b.name })), { key: 'bank', label: myBank ? `בבנק — ${myBank}` : 'בבנק' }, { key: 'other', label: 'אחר' }]} />;
  } else if (key === 'horizon') {
    title = 'לכמה זמן הכסף יכול להיות מושקע?';
    body = <Options name="טווח ההשקעה" options={I.HORIZONS} current={d.horizon} onPick={pick} />;
  } else if (key === 'goal') {
    title = 'בשביל מה?';
    body = <Options name="המטרה" options={I.GOALS} current={d.goal} onPick={pick} />;
  } else if (key === 'money') {
    title = 'כמה כסף מדובר?';
    const next = () => {
      const a = lump.trim() ? L.parseAmount(lump) : 0;
      const b = monthly.trim() ? L.parseAmount(monthly) : 0;
      if (a === null || b === null) return setError('הסכומים צריכים להיות מספרים, למשל 500.');
      advance({ lump: a, monthly: b });
    };
    body = (
      <>
        <div className="form-field">
          <label htmlFor="inv-lump">סכום חד־פעמי להתחלה</label>
          <div className="money-field"><input id="inv-lump" className="field" inputMode="decimal" autoComplete="off" value={lump} placeholder="0" onChange={(e) => setLump(e.target.value)} /><span className="cur" aria-hidden="true">{state.settings.currency}</span></div>
        </div>
        <div className="form-field">
          <label htmlFor="inv-monthly">הפקדה חודשית</label>
          <div className="money-field"><input id="inv-monthly" className="field" inputMode="decimal" autoComplete="off" value={monthly} placeholder="0" onChange={(e) => setMonthly(e.target.value)} /><span className="cur" aria-hidden="true">{state.settings.currency}</span></div>
          <span className="hint">{monthlyHint}</span>
        </div>
        <p className="form-error" role="alert">{error}</p>
        <button type="button" className="btn btn-primary inv-next" onClick={next}>המשך</button>
      </>
    );
  } else if (key === 'market') {
    title = 'איפה הכי מעניין אותך לקנות?';
    body = <MarketCards current={d.market} onPick={pick} />;
  }
  return (
    <section className="inv-q">
      <div className="inv-progress" role="progressbar" aria-valuemin={1} aria-valuemax={list.length} aria-valuenow={q.step + 1} aria-label={`שאלה ${q.step + 1} מתוך ${list.length}`}>
        {list.map((s, i) => <span key={s} className={i <= q.step ? 'on' : ''} />)}
      </div>
      <p className="eyebrow">שאלה {q.step + 1} מתוך {list.length}</p>
      <h2 className="inv-q-title">{title}</h2>
      <p className="inv-why"><span>למה שואלים?</span> {WHY[key] || ''}</p>
      {body}
      <div className="inv-q-foot">
        <button type="button" className="link" onClick={back}>{q.step ? 'חזרה לשאלה הקודמת' : 'חזרה'}</button>
        <button type="button" className="link small" onClick={wipe}>איפוס הכל</button>
      </div>
    </section>
  );
}

function BankSection({ state }) {
  const act = useActions();
  const last = lastSnap(state);
  const name = L.bankName(state.settings.bank);
  if (!name && !(last && last.assets.bankInvest)) {
    return (
      <section className="section-gap inv-bank" aria-labelledby="inv-bank-h">
        <div className="sec-head"><h2 className="sec-title" id="inv-bank-h">הבנק שלך</h2></div>
        <p className="block-p">באיזה בנק החשבון, כמה בעו״ש וכמה מושקע דרך הבנק — מזינים בצ׳ק־אין החודשי, ושקל בצד יראה כאן כמה זה עולה לך.</p>
        <button type="button" className="btn btn-line btn-small" onClick={() => act.openCheckIn()}>לצ׳ק־אין</button>
      </section>
    );
  }
  const checking = last ? last.assets.checking : 0;
  const bankInv = last ? last.assets.bankInvest : 0;
  const cost = I.bankCustodyYearly(bankInv);
  return (
    <section className="section-gap inv-bank" aria-labelledby="inv-bank-h">
      <div className="sec-head"><h2 className="sec-title" id="inv-bank-h">הבנק שלך{name ? ` · ${name}` : ''}</h2><button type="button" className="link" onClick={() => act.openCheckIn()}>עדכון</button></div>
      <ul className="kv">
        <li><span>עו״ש</span><M a={checking} round /></li>
        <li><span>השקעות דרך הבנק</span>{bankInv ? <M a={bankInv} round /> : <span className="muted">אין</span>}</li>
      </ul>
      {bankInv > 0 && (
        <p className="callout">על תיק של <M a={bankInv} round /> בבנק, דמי המשמרת הם בדרך כלל {I.BANK_CUSTODY.low * 100}%–{I.BANK_CUSTODY.high * 100}% בשנה — כ־<strong><M a={cost.low} round />–<M a={cost.high} round /> בשנה</strong>, עוד לפני עמלות קנייה. ברוב בתי ההשקעות בטבלה למטה אין דמי משמרת באחוזים. אפשר גם לבקש מהבנק הנחה — זה עובד לא מעט.</p>
      )}
      {!bankInv && checking > 0 && last && <p className="block-p">כסף שיושב בעו״ש לא צובר ריבית ברוב הבנקים. מה שמעבר לכרית הביטחון יכול לעבוד — בפיקדון, בקרן כספית, או בהשקעה לטווח ארוך.</p>}
    </section>
  );
}

function Portfolio({ state }) {
  const act = useActions();
  const last = lastSnap(state);
  if (!last) {
    return (
      <section className="section-gap">
        <p className="block-p">כדי לראות כאן את התיק שלך, מזינים את הסכומים בצ׳ק־אין החודשי.</p>
        <button type="button" className="btn btn-line btn-small" onClick={() => act.openCheckIn()}>לצ׳ק־אין</button>
      </section>
    );
  }
  const rows = L.ASSET_TYPES.filter((a) => a.group !== 'liquid' && last.assets[a.key]);
  return (
    <section aria-labelledby="inv-pf-h">
      <div className="sec-head"><h2 className="sec-title" id="inv-pf-h">התיק שלך</h2><button type="button" className="link" onClick={() => act.openCheckIn()}>עדכון</button></div>
      {rows.length ? (
        <ul className="kv">
          {rows.map((a) => (
            <li key={a.key}><span>{a.label}{last.usd?.[a.key] ? <> <span className="small muted">(${(last.usd[a.key] / 100).toLocaleString('en-US')})</span></> : null}</span><M a={last.assets[a.key]} round /></li>
          ))}
          <li><strong>סה״כ השקעות וחיסכון לטווח ארוך</strong><strong><M a={last.invest + last.longterm} round /></strong></li>
        </ul>
      ) : <p className="block-p">בצ׳ק־אין האחרון לא הוזנו השקעות. אפשר לעדכן שם.</p>}
    </section>
  );
}

function Brokers({ state, p }) {
  const money = useMoney();
  const rate = state.settings.usdRate?.rate || L.DEFAULT_USD_ILS;
  const list = I.compareBrokers({ market: p.market, monthly: p.monthly, lump: p.lump, usdIls: rate });
  const cheapest = list.filter((x) => x.cost.available)[0];
  const mine = state.invest.status === 'investing' ? list.find((x) => x.broker.id === state.invest.broker) : null;
  const venue = p.market === 'us' ? 'ארה״ב' : 'תל אביב';
  let summary = null;
  if (!p.monthly && !p.lump) summary = <p className="block-p">הזינו סכום בשאלון כדי לראות כמה זה יעלה בכל בית השקעות.</p>;
  else if (mine && mine.cost.available && cheapest && mine.broker.id !== cheapest.broker.id) {
    summary = <p className="callout">אצל {mine.broker.name} זה עולה בערך <M a={mine.cost.total} round /> בשנה. ב{cheapest.broker.name}: <M a={cheapest.cost.total} round />. הפרש של כ־<strong><M a={mine.cost.total - cheapest.cost.total} round /> בשנה</strong>.</p>;
  } else if (cheapest) {
    summary = <p className="callout">לפרופיל שלך ({money(p.monthly, { round: true })} בחודש, {venue}) העלות הנמוכה ביותר: <strong>{cheapest.broker.name}</strong>, כ־<M a={cheapest.cost.total} round /> בשנה.</p>;
  }
  return (
    <section className="section-gap" aria-labelledby="inv-br-h">
      <div className="sec-head"><h2 className="sec-title" id="inv-br-h">השוואת בתי השקעות</h2><span className="small muted">מסחר ב{venue}</span></div>
      <p className="block-p">איך קוראים את זה: המספר הגדול בכל כרטיס הוא כמה זה יעלה לך <strong>בשנה</strong> — עמלות קנייה על כל הפקדה ועוד דמי טיפול. מסודר מהזול ליקר, לפי הסכומים שענית בשאלון.</p>
      {summary}
      {p.market === 'us' && (p.monthly || p.lump) ? <p className="block-p"><strong>שימו לב:</strong> בהשקעה בדולרים, מרווח ההמרה משקל לדולר (בדוגמאות שפורסמו כ־0.5%–0.7% מכל הפקדה) יכול להיות גדול מהעמלות עצמן — והוא לא כלול בחישוב. כדאי לבדוק אותו בכל בית השקעות.</p> : null}
      <ol className="brokers">
        {list.map((x, i) => {
          const b = x.broker;
          const c = x.cost;
          const isMine = mine && mine.broker.id === b.id;
          const venueFee = p.market === 'us'
            ? (b.us ? (b.us.freeTrades ? `חינם עד ${b.us.freeTrades} פעולות, אחר כך מינימום $${b.us.min}` : `מינימום ${b.us.minRange || `$${b.us.min}`} לפעולה`) : 'לא זמין')
            : (b.ta ? `${b.ta.rateRange || `${(b.ta.rate * 100).toFixed(2).replace(/0$/, '')}%`}, מינימום ₪${b.ta.min}` : 'לא זמין ללקוחות פרטיים');
          const best = c.available && i === 0;
          return (
            <li key={b.id} className={`broker${best ? ' is-best' : ''}${isMine ? ' is-mine' : ''}${c.available ? '' : ' is-na'}`}>
              <div className="broker-top">
                <span className="broker-name">{b.name}{best && <> <span className="badge">הכי זול לפרופיל שלך</span></>}{isMine && <> <span className="badge badge-line">שלך</span></>}</span>
                <span className="broker-cost">{c.available ? <><M a={c.total} round /><span className="small muted"> לשנה</span></> : <span className="small muted">לא זמין</span>}</span>
              </div>
              <dl className="broker-facts">
                <div><dt>עמלת קנייה</dt><dd>{venueFee}</dd></div>
                <div><dt>דמי טיפול</dt><dd>{b.custodyPct ? `${b.custodyPct * 100}% מהתיק בשנה` : b.monthly ? `₪${b.monthly} לחודש${b.offset ? ', מתקזז מול עמלות' : ''}` : 'פטור'}</dd></div>
                <div><dt>המרת מט״ח</dt><dd>{b.fx}</dd></div>
                <div><dt>מינימום לפתיחה</dt><dd>{b.minDeposit ? (b.minDepositRange || money(b.minDeposit * 100, { round: true })) : 'אין'}{x.belowMin && <> <span className="warn-text">(יותר מהסכום שלך)</span></>}</dd></div>
              </dl>
              {(b.promo || b.note) && <p className="broker-note">{[b.promo, b.note].filter(Boolean).join('. ')}</p>}
            </li>
          );
        })}
      </ol>
      <p className="small muted">
        העלות השנתית היא הערכה: קנייה אחת בכל הפקדה, בלי מבצעי הצטרפות, ובלי מרווח המרת מט״ח{p.market === 'us' ? `. דולר מחושב לפי שער הדולר היומי: ₪${rate.toFixed(2)}` : ''}. התעריפים נבדקו ב{I.FEES_CHECKED} מול{' '}
        {I.FEE_SOURCES.map((s, i) => <span key={s.url}>{i > 0 && ', '}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></span>)}
        . המקורות לא תמיד מסכימים, ובמקרה כזה החישוב לוקח את הערך היקר. לפני שפותחים חשבון — לבדוק בתעריפון הרשמי.
      </p>
    </section>
  );
}

function Pension({ state }) {
  const dispatch = useDispatch();
  const money = useMoney();
  const balance = lastSnap(state)?.assets.pension || 0;
  const pp = state.invest.pension || { monthly: 0, depositFee: 0, savingsFee: 0 };
  const pct = (v) => (v ? String(+(v * 100).toFixed(2)) : '');
  const [vals, setVals] = useState({ monthly: pp.monthly ? String(pp.monthly / 100) : '', depositFee: pct(pp.depositFee), savingsFee: pct(pp.savingsFee) });
  const onInput = (k, raw) => {
    setVals((v) => ({ ...v, [k]: raw }));
    const r = raw.trim().replace('%', '');
    const next = { ...pp };
    if (k === 'monthly') {
      const a = r ? L.parseAmount(r) : 0;
      if (a === null) return;
      next.monthly = a;
    } else {
      const v = r ? Number(r) / 100 : 0;
      if (!Number.isFinite(v) || v < 0) return;
      next[k] = Math.min(k === 'depositFee' ? I.PENSION_CAPS.deposit : I.PENSION_CAPS.savings, v);
    }
    dispatch(D.setInvest({ pension: next }));
  };
  let result;
  if (!balance && !pp.monthly) result = <p className="small muted">מזינים צבירה (בצ׳ק־אין) או הפקדה חודשית כדי לראות את החישוב.</p>;
  else if (!pp.depositFee && !pp.savingsFee) result = <p className="small muted">מזינים את דמי הניהול שלך. הם מופיעים בדוח השנתי או באפליקציה של הקרן.</p>;
  else {
    const mine = I.pensionFees({ balance, monthly: pp.monthly, depositFee: pp.depositFee, savingsFee: pp.savingsFee });
    const good = I.pensionFees({ balance, monthly: pp.monthly, depositFee: Math.min(pp.depositFee, I.PENSION_GOOD.deposit), savingsFee: Math.min(pp.savingsFee, I.PENSION_GOOD.savings) });
    const diff = good.endBalance - mine.endBalance;
    result = (
      <>
        <ul className="kv">
          <li><span>דמי ניהול ב־20 שנה, בתנאים שלך</span><M a={mine.paid} round /></li>
          <li><span>בתנאים טובים ({I.PENSION_GOOD.deposit * 100}% מהפקדה, {(I.PENSION_GOOD.savings * 100).toFixed(2)}% מצבירה)</span><M a={good.paid} round /></li>
        </ul>
        {diff > 0
          ? <p className="callout">הפרש בצבירה בסוף התקופה: <strong><M a={diff} round /></strong>. אפשר לבקש מהקרן להוריד דמי ניהול, או לעבור קרן — בדרך כלל בטלפון אחד.</p>
          : <p className="callout">דמי הניהול שלך כבר טובים. אין כאן מה לשפר.</p>}
        <p className="small muted">חישוב בהנחת תשואה של 5% בשנה. התקרה בחוק: עד 6% מההפקדה ועד 0.5% מהצבירה.</p>
      </>
    );
  }
  return (
    <section className="section-gap" aria-labelledby="inv-pen-h">
      <div className="sec-head"><h2 className="sec-title" id="inv-pen-h">בדיקת דמי ניהול בפנסיה</h2></div>
      <p className="block-p">דמי ניהול גבוהים בפנסיה הם אחד הדליפות הכי יקרות — ושקטות. {balance ? `הצבירה שלך לפי הצ׳ק־אין: ${money(balance, { round: true })}.` : ''}</p>
      <div className="pen-grid">
        <div className="form-field"><label htmlFor="pen-monthly">הפקדה חודשית</label><div className="money-field"><input id="pen-monthly" className="field" inputMode="decimal" value={vals.monthly} placeholder="0" onChange={(e) => onInput('monthly', e.target.value)} /><span className="cur" aria-hidden="true">₪</span></div></div>
        <div className="form-field"><label htmlFor="pen-dep">דמי ניהול מהפקדה (%)</label><input id="pen-dep" className="field" inputMode="decimal" value={vals.depositFee} placeholder="למשל 1.5" onChange={(e) => onInput('depositFee', e.target.value)} /></div>
        <div className="form-field"><label htmlFor="pen-sav">דמי ניהול מצבירה (%)</label><input id="pen-sav" className="field" inputMode="decimal" value={vals.savingsFee} placeholder="למשל 0.22" onChange={(e) => onInput('savingsFee', e.target.value)} /></div>
      </div>
      <div aria-live="polite">{result}</div>
    </section>
  );
}

function Results({ state, setQ, wipe }) {
  const dispatch = useDispatch();
  const money = useMoney();
  const p = state.invest.profile;
  const t = today();
  const plan = I.investPlan(p, { avgSpend: L.avgMonthlySpend(state, t), liquid: lastSnap(state)?.liquid || 0 }, state.settings.currency);
  const max = Math.max(...plan.projection.map((x) => x.value), plan.deposited, 1);
  const w = (v) => `${((v / max) * 100).toFixed(1)}%`;
  return (
    <>
      <section className="inv-hero vault" aria-labelledby="inv-h">
        <p className="vault-label">{STATUS.find((s) => s.key === state.invest.status)?.label || ''}</p>
        <h2 className="inv-title" id="inv-h">התוכנית שלך</h2>
        <ul className="inv-chips">
          <li><span>טווח</span>{I.HORIZONS.find((h) => h.key === p.horizon)?.label}</li>
          <li><span>מטרה</span>{I.GOALS.find((g) => g.key === p.goal)?.label}</li>
          <li><span>חודשי</span>{money(p.monthly, { round: true })}</li>
          {p.lump > 0 && <li><span>להתחלה</span>{money(p.lump, { round: true })}</li>}
        </ul>
        <div className="inv-hero-actions">
          <button type="button" className="link link-on-dark" onClick={() => { setQ({ active: true, step: 0, draft: { ...p, broker: state.invest.broker } }); window.scrollTo(0, 0); }}>לשנות תשובות</button>
          <button type="button" className="link link-on-dark" onClick={() => { dispatch(D.setInvest({ status: null, profile: null })); setQ({ active: false }); window.scrollTo(0, 0); }}>לשנות מצב</button>
          <button type="button" className="link link-on-dark" onClick={wipe}>איפוס הכל</button>
        </div>
      </section>

      {state.invest.status === 'investing' && <Portfolio state={state} />}
      <BankSection state={state} />

      <section className="section-gap" aria-labelledby="inv-notes-h">
        <div className="sec-head"><h2 className="sec-title" id="inv-notes-h">מה חשוב לדעת</h2></div>
        <ol className="tips">{plan.notes.map((n) => <li key={n.title}><p className="tip-title">{n.title}</p><p className="tip-detail">{n.text}</p></li>)}</ol>
      </section>

      {(p.monthly > 0 || p.lump > 0) && (
        <section className="section-gap" aria-labelledby="inv-proj-h">
          <div className="sec-head"><h2 className="sec-title" id="inv-proj-h">איך זה יכול להיראות בעוד {plan.years === 1 ? 'שנה' : `${plan.years} שנים`}</h2></div>
          <ul className="shares">
            <li><span className="sh-name">רק הפקדות</span><span className="sh-bar sh-flat" aria-hidden="true"><span style={{ width: w(plan.deposited) }} /></span><span className="sh-val"><M a={plan.deposited} round /></span></li>
            {plan.projection.map((x) => (
              <li key={x.rate}><span className="sh-name">{Math.round(x.rate * 100)}% בשנה</span><span className="sh-bar" aria-hidden="true"><span style={{ width: w(x.value) }} /></span><span className="sh-val"><M a={x.value} round /></span></li>
            ))}
          </ul>
          <p className="small muted">תרחישים להמחשה בלבד, לפני מסים ועמלות. השוק יכול גם לרדת, ותשואות עבר לא מבטיחות תשואות עתידיות.</p>
        </section>
      )}

      {(plan.selfDirected || state.invest.status === 'investing') && <Brokers state={state} p={p} />}
      <Pension state={state} />
      <Glossary />
      <Disclaimer />
    </>
  );
}

export function InvestPage() {
  const state = useData();
  const { invQ: q } = useUi();
  const dispatch = useDispatch();
  const { toast } = useOverlay();
  const setQ = (x) => dispatch(U.setInvQ(x));
  const inv = state.invest;

  const wipe = () => {
    if (!confirm('לאפס את כל נתוני ההשקעות? התשובות לשאלון, בית ההשקעות ונתוני הפנסיה יימחקו. הסכומים בצ׳ק־אין נשארים.')) return;
    dispatch(D.resetInvest());
    setQ({ active: false, step: 0, draft: {} });
    window.scrollTo(0, 0);
    toast('נתוני ההשקעות אופסו');
  };
  const advance = (patch) => {
    const draft = { ...q.draft, ...patch };
    const list = steps(inv.status);
    if (q.step < list.length - 1) {
      setQ({ draft, step: q.step + 1 });
      window.scrollTo(0, 0);
      return;
    }
    dispatch(D.setInvest({
      profile: { horizon: draft.horizon || 'long', goal: draft.goal || 'grow', lump: draft.lump || 0, monthly: draft.monthly || 0, market: draft.market === 'us' ? 'us' : 'ta' },
      ...(draft.broker ? { broker: draft.broker } : {}),
    }));
    setQ({ active: false, step: 0, draft: {} });
    window.scrollTo(0, 0);
    toast('התוכנית מוכנה');
  };
  const pick = (v) => advance({ [steps(inv.status)[q.step]]: v });

  if (!inv.status) {
    return (
      <>
        <Tip id="invest" title="לא צריך להבין הכל">מתחילים מהשאלה הראשונה, ומקבלים הסבר פשוט לפי המצב שלך. כל מונח לא מוכר מוסבר במילון בתחתית העמוד.</Tip>
        <section className="inv-hero vault" aria-labelledby="inv-h">
          <p className="vault-label">השקעות ושוק ההון</p>
          <h2 className="inv-title" id="inv-h">מה המצב שלך עם השקעות?</h2>
          <p className="hero-sub">לפי התשובה שקל בצד יתאים את העמוד: השוואת עמלות בין בתי ההשקעות, בדיקת דמי ניהול בפנסיה, ומה כדאי לדעת לפני שמתחילים.</p>
        </section>
        <section>
          <Options name="המצב שלך" options={STATUS} current={inv.status} onPick={(v) => {
            dispatch(D.setInvest({ status: v }));
            setQ({ active: true, step: 0, draft: { ...(inv.profile || {}), broker: inv.broker } });
            window.scrollTo(0, 0);
          }} />
        </section>
        <section className="section-gap">
          <div className="sec-head"><h2 className="sec-title">מה יש כאן</h2></div>
          <ol className="inv-steps">
            <li><strong>4–5 שאלות קצרות</strong><span>לכמה זמן, בשביל מה, כמה כסף, ואיפה לקנות.</span></li>
            <li><strong>מה חשוב לדעת</strong><span>לפי התשובות שלך: כרית ביטחון, הטבות מס בישראל, וטווח ההשקעה.</span></li>
            <li><strong>כמה זה יעלה לך</strong><span>השוואת עמלות בין בתי ההשקעות לפי הסכומים שלך.</span></li>
            <li><strong>הפנסיה שלך</strong><span>בדיקה כמה דמי הניהול עולים לך לאורך השנים.</span></li>
          </ol>
        </section>
        <Glossary />
        <Disclaimer />
      </>
    );
  }
  if (!inv.profile || q.active) {
    return <Question key={`${inv.status}-${q.step}`} state={state} q={q} setQ={setQ} pick={pick} advance={advance} wipe={wipe} />;
  }
  return <Results state={state} setQ={setQ} wipe={wipe} />;
}
