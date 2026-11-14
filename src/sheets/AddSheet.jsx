// The + sheet: record an expense or an income with the keypad.
// Flow: amount → place/category → (standing order?) → (over budget? "are you sure") → where did the money come from → saved.
import { useMemo, useRef, useState, useEffect } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import * as L from '../lib/logic.js';
import { D } from '../store/dataSlice.js';
import { Sheet } from '../components/Sheet.jsx';
import { useOverlay } from '../components/UiProvider.jsx';
import { useActions } from '../hooks/useActions.jsx';
import { useMoney, daysWord } from '../hooks/useApp.js';
import { Dot, M } from '../components/ui.jsx';
import { byNewest } from '../components/Rows.jsx';
import { tick } from '../lib/fx.js';
import { Tip } from '../components/Tip.jsx';

const PAY_ICON = {
  credit: <><path d="M3.5 7h17v11h-17z" /><path d="M3.5 10.5h17M7 15h4" /></>,
  app: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" /></>,
  cash: <><rect x="2.5" y="6.5" width="19" height="11" rx="2" /><circle cx="12" cy="12" r="2.6" /></>,
  transfer: <path d="M4 9h14l-3.5-3.5M20 15H6l3.5 3.5" />,
  checking: <path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3.5 20h17" />,
};

function requestPersistence() {
  try { navigator.storage?.persist?.(); } catch { /* not supported */ }
}

function AddBody({ opts, close }) {
  const store = useStore();
  const state = useSelector((s) => s.data);
  const dispatch = useDispatch();
  const money = useMoney();
  const act = useActions();
  const { toast } = useOverlay();
  const t = L.todayISO();
  const { expense, income } = opts;
  const rec = expense || income;
  const editingId = rec?.id || null;
  const active = state.categories.filter((c) => !c.archived);
  const catById = (id) => state.categories.find((c) => c.id === id);

  const [kind, setKind] = useState(income || opts.kind === 'income' ? 'income' : 'expense');
  const [str, setStr] = useState(rec ? String(rec.amount / 100) : opts.amount ? String(opts.amount / 100) : '');
  const [note, setNote] = useState(rec?.note || opts.note || '');
  const [date, setDate] = useState(rec?.date || opts.date || t);
  const [catId, setCatId] = useState(expense?.catId || opts.catId || (active.find((c) => c.name === 'אוכל בחוץ') || active[0])?.id);
  const [catTouched, setCatTouched] = useState(!!expense || !!opts.catId); // an explicit category wins over place memory
  const [source, setSource] = useState(income?.source || L.INCOME_SOURCES[0]);
  const [standing, setStanding] = useState(null);
  const [standingManual, setStandingManual] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [over, setOver] = useState(null); // { d, imp }
  const [pay, setPay] = useState(null); // { d, imp }
  const amountRef = useRef(null);
  const places = useMemo(() => L.learnPlaces(state.expenses, state.placePrefs), []); // eslint-disable-line react-hooks/exhaustive-deps

  // focus the amount (not the note field) so the iOS keyboard doesn't cover the keypad
  useEffect(() => { amountRef.current?.focus({ preventScroll: true }); }, []);

  const isIncome = kind === 'income';
  const draft = { amount: L.parseAmount(str || '0') || 0, catId, note: note.trim().slice(0, 80), date: date || t };
  const cat = catById(catId);

  // place memory
  const exact = !isIncome ? L.findPlace(places, note) : null;
  const shownPlaces = isIncome ? [] : L.matchPlaces(places.filter((p) => catById(p.catId) && !catById(p.catId).archived), note, 6);
  const placeHint = isIncome ? '' : exact
    ? `זוכר את ״${exact.name}״ · ${catById(exact.catId)?.name || ''} · ${exact.count} פעמים`
    : (() => {
      const k = L.placeKey(note);
      return k.length >= 2 && state.expenses.some((e) => !e.recurringId && L.placeKey(e.note) === k && e.id !== editingId) ? 'פעם שנייה כאן — מעכשיו אזכור את המקום.' : '';
    })();
  const onNote = (v) => {
    setNote(v);
    const ex = L.findPlace(places, v);
    if (ex && !catTouched && catById(ex.catId) && !catById(ex.catId).archived) setCatId(ex.catId);
  };
  const pickPlace = (p) => {
    setNote(p.name);
    setCatId(p.catId);
    setCatTouched(true);
    if (!str && p.usual) setStr(String(p.usual / 100));
  };

  // "is this a monthly standing order?"
  const hint = !isIncome && !editingId ? L.standingOrderHint(state, draft) : null;
  const standingShown = !!hint && !hint.existing && (hint.ask || standingManual);
  const standingQ = hint?.reason === 'pattern'
    ? 'זה הופיע גם בחודשים קודמים באותו סכום. הוראת קבע שיורדת כל חודש?'
    : hint?.reason === 'category' || hint?.reason === 'keyword' ? 'נראה כמו מנוי. זה יורד כל חודש? (הוראת קבע)' : 'זה יורד כל חודש? (הוראת קבע)';

  // what this does to the category's budget
  const impact = (() => {
    if (isIncome || !cat) return null;
    const imp = L.impactOf(state, { ...draft, amount: draft.amount || 1, excludeId: editingId }, t);
    if (!imp) return { text: cat.budget ? '' : `ל${cat.name} אין תקציב — רק מעקב.` };
    if (!draft.amount) {
      const left = imp.budget - imp.before;
      return left >= 0 ? { text: <>נשארו <M a={left} /> ל{cat.name} במחזור הזה</> } : { cls: 'is-over', text: <>{cat.name}: כבר בחריגה של <M a={-left} /></> };
    }
    if (imp.willBeOver) return { cls: 'is-over', text: imp.wasOver ? <>{cat.name} כבר בחריגה. אחרי זה: <M a={imp.overBy} /> מעל התקציב</> : <>זה יעבור את תקציב {cat.name} ב־<M a={imp.overBy} /></> };
    const warn = imp.after >= imp.budget * (state.settings.alertAt ?? 0.8);
    return { cls: warn ? 'is-warn' : '', text: <>אחרי זה נשארו <M a={imp.leftAfter} /> ל{cat.name}{imp.currentCycle && imp.daysLeft ? <> · <M a={imp.perDayAfter} round /> ליום</> : null}</> };
  })();

  const press = (k) => {
    setStr((s) => L.keypadInput(s, k));
    setError('');
  };

  /* ---------- saving ---------- */
  const saveExpense = (d, imp) => {
    const now = store.getState().data;
    const pk = L.placeKey(d.note);
    // is this the expense that makes a place "remembered"?
    const learned = !editingId && pk.length >= 2 && !now.placePrefs?.[pk]?.hidden
      && now.expenses.filter((e) => !e.recurringId && L.placeKey(e.note) === pk).length === L.MIN_PLACE_COUNT - 1;
    // the standing-order answer only counts while the question is on screen
    const isStanding = !editingId && standing === 'yes' && standingShown;
    let recurring = null;
    let savedId = editingId;
    if (editingId) dispatch(D.updateExpense({ id: editingId, changes: d }));
    else if (isStanding) {
      const a = D.addStandingExpense({ draft: d, today: t });
      dispatch(a);
      recurring = a.payload.recurring;
    } else {
      const a = D.addExpense(d);
      dispatch(a);
      savedId = a.payload.id;
    }
    if (!editingId) requestPersistence();
    close();
    const c = catById(d.catId);
    if (recurring) {
      toast(`נרשם ${money(d.amount)}. מעכשיו ״${recurring.name}״ יירשם לבד ב־${recurring.day} בכל חודש.`, {
        action: 'ביטול',
        onAction: () => { dispatch(D.undoStanding(recurring.id)); toast('בוטל, כולל הוראת הקבע'); },
      });
    } else if (imp && imp.willBeOver && imp.currentCycle) {
      toast(`נרשם. ${c.name}: ${money(imp.overBy)} מעל התקציב החודש.`, { alert: true });
    } else if (imp && imp.crossesWarn && imp.currentCycle) {
      toast(`שימו לב: נשארו ${money(imp.leftAfter)} ל${c.name}${imp.daysLeft ? ` — ${money(imp.perDayAfter, { round: true })} ליום עד סוף המחזור` : ''}.`, { alert: true });
    } else if (!editingId && now.expenses.every((e) => e.recurringId || e.spreadId)) {
      const nm = now.settings.name;
      toast(`ההוצאה הראשונה נרשמה${nm ? `, ${nm}` : ''}. ככה בונים הרגל — רושמים כל פעם, וזה לוקח שניות.`, {
        action: 'ביטול',
        onAction: () => { dispatch(D.removeExpense(savedId)); toast('ההוצאה בוטלה'); },
      });
    } else if (!editingId) {
      toast(`נרשם ${money(d.amount)} · ${c.name}${learned ? `. זכרתי את ״${d.note}״ — בפעם הבאה הקטגוריה תיבחר לבד.` : ''}`, {
        action: 'ביטול',
        onAction: () => { dispatch(D.removeExpense(savedId)); toast('ההוצאה בוטלה'); },
      });
    } else toast('השינוי נשמר');
  };

  const saveIncome = (d) => {
    const data = { amount: d.amount, date: d.date, note: d.note, source, ...(d.to ? { to: d.to } : {}) };
    close();
    if (editingId) {
      dispatch(D.updateIncome({ id: editingId, changes: data }));
      return toast('השינוי נשמר');
    }
    const a = D.addIncome(data);
    dispatch(a);
    toast(`נרשמה הכנסה ${money(d.amount)} · ${source}`, { action: 'ביטול', onAction: () => dispatch(D.removeIncome(a.payload.id)) });
  };

  const submit = () => {
    const d = draft;
    if (!d.amount) {
      setError('חסר סכום. הקלידו אותו במקשים.');
      setShake((n) => n + 1);
      return;
    }
    if (isIncome) {
      if (editingId) saveIncome(d);
      else setPay({ d, imp: null });
      return;
    }
    if (!catById(d.catId)) return setError('בחרו קטגוריה.');
    const imp = L.impactOf(state, { ...d, excludeId: editingId }, t);
    const original = editingId && state.expenses.find((e) => e.id === editingId);
    const growing = !original || d.amount > original.amount || d.catId !== original.catId;
    if (imp && imp.willBeOver && imp.currentCycle && state.settings.confirmOver && growing) return setOver({ d, imp });
    if (editingId) saveExpense(d, imp);
    else setPay({ d, imp });
  };

  const choosePay = (key) => {
    const { d, imp } = pay;
    tick(10);
    setPay(null);
    if (isIncome) saveIncome({ ...d, to: key === 'cash' ? 'cash' : undefined });
    else {
      dispatch(D.setSetting({ key: 'lastPay', value: key }));
      saveExpense({ ...d, pay: key }, imp);
    }
  };

  const remove = () => {
    close();
    if (income) {
      dispatch(D.removeIncome(income.id));
      toast('ההכנסה נמחקה', { action: 'ביטול', onAction: () => dispatch(D.restoreIncome(income)) });
    } else {
      dispatch(D.removeExpense(expense.id));
      toast('ההוצאה נמחקה', { action: 'ביטול', onAction: () => dispatch(D.restoreExpense(expense)) });
    }
  };

  const overSkip = () => {
    const { d } = over;
    setOver(null);
    close();
    if (editingId) return;
    const a = D.addResisted({ name: d.note || catById(d.catId)?.name || '', amount: d.amount, date: t, goalId: null, catId: d.catId });
    dispatch(a);
    toast(`יפה. ${money(d.amount)} נשארו אצלך — נרשם בחיסכון.`, { action: 'ביטול', onAction: () => dispatch(D.removeResisted(a.payload.id)) });
  };
  const overAnyway = () => {
    const { d, imp } = over;
    setOver(null);
    if (editingId) saveExpense(d, imp);
    else setPay({ d, imp });
  };

  // physical keyboard support when the note field isn't focused
  const onKeyDown = (ev) => {
    if (ev.target.matches('input') || pay) return;
    if (/^\d$/.test(ev.key) || ev.key === '.') { press(ev.key); ev.preventDefault(); }
    else if (ev.key === 'Backspace') { press('back'); ev.preventDefault(); }
    else if (ev.key === 'Enter' && !ev.target.matches('button')) { submit(); ev.preventDefault(); }
  };

  const [whole, frac] = (str || '0').split('.');
  const amountText = `${state.settings.currency}${Number(whole || 0).toLocaleString('en-US')}${frac !== undefined ? `.${frac}` : ''}`;
  const catList = [...active];
  const ec = expense && catById(expense.catId);
  if (ec && ec.archived) catList.push(ec);

  // pay step
  const bal = pay ? L.liveBalances(state, t) : null;
  const lastPayFor = (n) => {
    const k = L.placeKey(n);
    if (!k) return null;
    const e = state.expenses.filter((x) => x.pay && L.placeKey(x.note) === k).sort(byNewest)[0];
    return e ? e.pay : null;
  };
  const prevPay = pay && !isIncome ? lastPayFor(pay.d.note) : null;
  const suggested = isIncome ? 'checking' : prevPay || state.settings.lastPay || 'credit';
  const tiles = isIncome ? [{ key: 'checking', label: 'לעו״ש', from: 'checking' }, { key: 'cash', label: 'למזומן', from: 'cash' }] : L.PAY_METHODS;
  const after = (from) => {
    if (!bal) return '';
    const n = from === 'cash' ? bal.cash : bal.checking;
    return `יישארו ${money(n + (isIncome ? pay.d.amount : -pay.d.amount), { round: true })}`;
  };
  const suggestedRef = useRef(null);
  useEffect(() => { if (pay) suggestedRef.current?.focus({ preventScroll: true }); }, [pay]);

  return (
    <>
      <form className={`sheet-body ${pay ? 'is-paying' : ''}`} id="add-form" noValidate onKeyDown={onKeyDown} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="sheet-head">
          <h2 id="add-title">{editingId ? (isIncome ? 'עריכת הכנסה' : 'עריכת הוצאה') : isIncome ? 'הכנסה חדשה' : 'הוצאה חדשה'}</h2>
          <button type="button" className="link" data-close>ביטול</button>
        </div>

        <div className="kind seg" role="radiogroup" aria-label="סוג הרישום">
          {[['expense', 'הוצאה'], ['income', 'הכנסה']].map(([v, l]) => (
            // the kind can't change while editing an existing record
            <label key={v}><input type="radio" name="kind" value={v} checked={kind === v} disabled={!!editingId} onChange={() => setKind(v)} /><span>{l}</span></label>
          ))}
        </div>

        {!editingId && <Tip id="add" title="איך רושמים">מקלידים סכום במקשים, כותבים איפה (לא חובה), בוחרים קטגוריה — ולוחצים ״לרשום״. בסוף שואלים איך שילמת, כדי שהיתרה תתעדכן.</Tip>}
        <div className="amount-wrap">
          <output key={shake} ref={amountRef} className={`amount${str ? '' : ' is-empty'}${isIncome ? ' is-income' : ''}${shake ? ' shake' : ''}`} tabIndex={-1} aria-live="polite" aria-label="סכום">{amountText}</output>
          <p className={`impact ${impact?.cls || ''}`} aria-live="polite">{impact?.text}</p>
        </div>

        <div className="place">
          <div className="add-row">
            <label className="sr-only" htmlFor="add-note">איפה, או על מה</label>
            <input id="add-note" className="field" type="text" maxLength={80} placeholder={isIncome ? 'פירוט (לא חובה)' : 'איפה? (שופרסל, ארומה…)'}
              autoComplete="off" autoCorrect="off" enterKeyHint="done" aria-describedby="place-hint" value={note}
              onChange={(e) => onNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }} />
            <label className="sr-only" htmlFor="add-date">תאריך</label>
            <input id="add-date" className="field field-date" type="date" value={date} max={L.addDays(t, 366)} onChange={(e) => setDate(e.target.value)} />
          </div>
          {shownPlaces.length > 0 && (
            <div className="place-list" role="group" aria-label="מקומות שזכרתי">
              {shownPlaces.map((p) => (
                <button key={p.key} type="button" aria-pressed={!!exact && exact.key === p.key} onClick={() => pickPlace(p)}>
                  {p.name}{p.usual ? <> <span className="num">{money(p.usual)}</span></> : null}
                </button>
              ))}
            </div>
          )}
          <p className="place-hint" id="place-hint" aria-live="polite">{placeHint}</p>
        </div>

        {!isIncome ? (
          <fieldset className="cats">
            <legend className="sr-only">קטגוריה</legend>
            <div className="cat-list">
              {catList.map((c) => (
                <label className="cat-chip" key={c.id}>
                  <input type="radio" name="cat" value={c.id} checked={c.id === catId} onChange={() => { setCatId(c.id); setCatTouched(true); }} />
                  <span><Dot color={c.color} />{c.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <fieldset className="cats">
            <legend className="sr-only">מקור ההכנסה</legend>
            <div className="cat-list">
              {L.INCOME_SOURCES.map((s) => (
                <label className="cat-chip" key={s}><input type="radio" name="source" value={s} checked={s === source} onChange={() => setSource(s)} /><span>{s}</span></label>
              ))}
            </div>
          </fieldset>
        )}

        {hint?.existing && (
          <div className="standing is-info"><p className="standing-q">״{hint.existing.name}״ כבר מוגדר כהוראת קבע ונרשם לבד ב־{hint.existing.day} בכל חודש.</p></div>
        )}
        {standingShown && (
          <div className="standing">
            <p className="standing-q" id="standing-q">{standingQ}</p>
            <div className="standing-opts" role="group" aria-labelledby="standing-q">
              <button type="button" aria-pressed={standing === 'yes'} onClick={() => setStanding(standing === 'yes' ? null : 'yes')}>כן, כל חודש</button>
              <button type="button" aria-pressed={standing === 'no'} onClick={() => setStanding(standing === 'no' ? null : 'no')}>לא, חד־פעמי</button>
            </div>
          </div>
        )}
        {hint && !hint.existing && !standingShown && (
          <button type="button" className="link small standing-open" onClick={() => { setStandingManual(true); setStanding('yes'); }}>חוזר כל חודש? (הוראת קבע)</button>
        )}

        <div className="keypad" role="group" aria-label="מקלדת סכום">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => <button key={k} type="button" onClick={() => press(k)}>{k}</button>)}
          <button type="button" aria-label="נקודה עשרונית" onClick={() => press('.')}>.</button>
          <button type="button" onClick={() => press('0')}>0</button>
          <button type="button" aria-label="מחיקת ספרה" onClick={() => press('back')}>⌫</button>
        </div>

        <p className="form-error" role="alert">{error}</p>

        {pay && (
          <div className="pay-step">
            <p className="pay-amount">{money(pay.d.amount)} · {isIncome ? source : pay.d.note || cat?.name || ''}</p>
            <h3 className="pay-q" id="pay-q">{isIncome ? 'לאן נכנס הכסף?' : 'מאיפה ירד הכסף?'}</h3>
            <div className="pay-grid" role="group" aria-labelledby="pay-q">
              {tiles.map((p) => (
                <button key={p.key} type="button" ref={p.key === suggested ? suggestedRef : undefined}
                  className={`pay-tile${p.key === suggested ? ' is-suggested' : ''}`} onClick={() => choosePay(p.key)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">{PAY_ICON[p.key]}</svg>
                  <span className="pay-l">{p.label}</span>
                  <span className="pay-s">{isIncome ? '' : p.from === 'cash' ? 'מהמזומן' : 'מהעו״ש'}{bal ? `${isIncome ? '' : ' · '}${after(p.from)}` : ''}</span>
                </button>
              ))}
            </div>
            <p className="small muted pay-note">{prevPay && pay.d.note ? `בפעם הקודמת ב״${pay.d.note}״ שילמת ב${L.payLabel(prevPay)}.` : ''}</p>
            <button type="button" className="link" onClick={() => { setPay(null); amountRef.current?.focus({ preventScroll: true }); }}>חזרה לעריכה</button>
          </div>
        )}

        <div className="sheet-actions">
          <button type="submit" className="btn btn-primary">{isIncome ? (draft.amount ? `לרשום הכנסה ${money(draft.amount)}` : 'לרשום הכנסה') : draft.amount ? `לרשום ${money(draft.amount)}` : 'לרשום'}</button>
          {!isIncome && !editingId && (
            <button type="button" className="link" onClick={() => { close(); act.openSpread(null, { total: draft.amount, name: draft.note, catId: draft.catId, start: draft.date }); }}>
              ביטוח או הוצאה שנתית? לפרוס על השנה
            </button>
          )}
          {rec && <button type="button" className="btn btn-danger-quiet" onClick={remove}>{income ? 'מחיקת ההכנסה' : 'מחיקת ההוצאה'}</button>}
        </div>
      </form>

      <Sheet open={!!over} onClose={() => setOver(null)} className="sheet sheet-alert" role="alertdialog" labelledBy="over-title">
        {over && (
          <div className="sheet-body" aria-describedby="over-text">
            <p className="over-kicker">רגע לפני</p>
            <h2 id="over-title">{over.imp.wasOver ? `${over.imp.cat.name} כבר מעל התקציב` : `זה יוציא אותך מתקציב ${over.imp.cat.name}`}</h2>
            <p id="over-text" className="over-text">
              {over.imp.wasOver
                ? <>התקציב החודשי הוא <M a={over.imp.budget} /> וכבר הוצאת <M a={over.imp.before} />. עם ההוצאה הזו: <strong><M a={over.imp.overBy} /> מעל</strong>.</>
                : <>התקציב החודשי הוא <M a={over.imp.budget} /> ונשארו בו <M a={over.imp.budget - over.imp.before} />. ההוצאה הזו (<M a={over.d.amount} />) תעבור אותו ב־<strong><M a={over.imp.overBy} /></strong>{over.imp.daysLeft > 1 ? `, ועוד ${daysWord(over.imp.daysLeft - 1)} עד סוף המחזור` : ''}.</>}
            </p>
            <div className="sheet-actions stack">
              <button type="button" className="btn btn-primary" autoFocus onClick={overSkip}>{editingId ? 'לא לשנות' : `ויתרתי — ${money(over.d.amount)} נשארים אצלי`}</button>
              <button type="button" className="btn btn-line" onClick={overAnyway}>לרשום בכל זאת</button>
              <button type="button" className="link" data-close>חזרה לעריכה</button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}

export function AddSheet() {
  const { add, closeAdd } = useOverlay();
  return (
    <Sheet open={!!add} onClose={closeAdd} labelledBy="add-title">
      {add && <AddBody key={add.key} opts={add} close={closeAdd} />}
    </Sheet>
  );
}
