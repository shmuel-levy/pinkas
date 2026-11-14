// הגדרות. Text fields save on blur (so the iPhone keyboard never jumps); selects and switches save at once.
import { useRef } from 'react';
import { useDispatch } from 'react-redux';
import * as L from '../lib/logic.js';
import { useData, useMoney, useCatById, today } from '../hooks/useApp.js';
import { useActions } from '../hooks/useActions.jsx';
import { D } from '../store/dataSlice.js';
import { U } from '../store/uiSlice.js';
import { useOverlay } from '../components/UiProvider.jsx';
import { M } from '../components/ui.jsx';
import { focusCat } from './HomePage.jsx';
import { shareOrDownload } from '../lib/platform.js';
import { VERSION } from '../lib/content.js';

const days28 = Array.from({ length: 28 }, (_, i) => i + 1);
const asText = (a) => (a ? String(a / 100) : '');

// A money input that commits on blur. Bad input is rejected and the field goes back to the saved value.
function MoneyInput({ value, onCommit, onBad, ...rest }) {
  return (
    <input className="field" inputMode="decimal" {...rest} key={value} defaultValue={asText(value)}
      onBlur={(e) => {
        const a = e.target.value.trim() ? L.parseAmount(e.target.value) : 0;
        if (a === null) {
          onBad();
          e.target.value = asText(value);
          return;
        }
        if (a !== value) onCommit(a);
      }} />
  );
}

export function SettingsPage({ onTour }) {
  const state = useData();
  const dispatch = useDispatch();
  const money = useMoney();
  const catById = useCatById();
  const act = useActions();
  const { toast } = useOverlay();
  const fileRef = useRef(null);
  const s = state.settings;
  const cats = state.categories;
  const active = cats.filter((c) => !c.archived);
  const derived = active.reduce((sum, c) => sum + (c.budget || 0), 0);
  const fc = focusCat(state);
  const t = today();

  const setSetting = (key, value, msg = 'נשמר') => {
    dispatch(D.setSetting({ key, value }));
    if (msg) toast(msg);
  };

  const delCat = (c) => {
    if (active.length <= 1) return toast('צריך לפחות קטגוריה אחת.');
    const used = state.expenses.some((e) => e.catId === c.id) || state.recurring.some((r) => r.catId === c.id);
    if (used) {
      dispatch(D.updateCategory({ id: c.id, changes: { archived: true } }));
      if (s.focusCatId === c.id) dispatch(D.setSetting({ key: 'focusCatId', value: null }));
      toast(`${c.name} הועברה לארכיון — ההוצאות הקודמות נשמרו.`, { action: 'ביטול', onAction: () => dispatch(D.updateCategory({ id: c.id, changes: { archived: false } })) });
    } else {
      const index = cats.indexOf(c);
      dispatch(D.removeCategory(c.id));
      toast(`${c.name} נמחקה`, { action: 'ביטול', onAction: () => dispatch(D.restoreCategory({ cat: c, index })) });
    }
  };

  const places = L.learnPlaces(state.expenses, state.placePrefs);
  const hidden = Object.entries(state.placePrefs || {}).filter(([, v]) => v.hidden).map(([k]) => k);
  const forget = (k) => {
    dispatch(D.setPlacePref({ key: k, pref: { hidden: true } }));
    toast(`שכחתי את ״${k}״`, { action: 'ביטול', onAction: () => dispatch(D.setPlacePref({ key: k, pref: { hidden: false } })) });
  };
  const spreads = [...state.spreads].sort((a, b) => (a.start < b.start ? 1 : -1));

  return (
    <>
      <section aria-labelledby="sp-prof" className="set-group" id="profile-section">
        <div className="sec-head"><h2 className="sec-title" id="sp-prof">הפרופיל שלך</h2><button type="button" className="link" onClick={() => dispatch(U.startQuiz({ id: 'profile', answers: { name: s.name, level: s.level, focus: s.focus } }))}>לענות שוב</button></div>
        <p className="block-p">לפי זה האפליקציה מדברת אליך, מחליטה כמה להסביר, ומה לשים במרכז המסך.</p>
        <div className="set-row">
          <label htmlFor="s-name">איך לקרוא לך</label>
          <input id="s-name" className="field" key={`nm${s.name}`} defaultValue={s.name} maxLength={24} placeholder="השם שלך" autoComplete="given-name"
            onBlur={(e) => { const v = e.target.value.trim().slice(0, 24); if (v !== s.name) setSetting('name', v); }} />
        </div>
        <div className="set-row profile-row">
          <span className="label" id="lvl-l">ניסיון<span className="hint">למתחילים: יותר הסברים וצעדים ברורים</span></span>
          <span className="seg" role="radiogroup" aria-labelledby="lvl-l">
            {[['beginner', 'מתחיל/ה'], ['some', 'קצת'], ['pro', 'מנוסה']].map(([v, l]) => (
              <label key={v}><input type="radio" name="level" value={v} checked={s.level === v} onChange={() => {
                setSetting('level', v, v === 'beginner' ? 'נשמר. ההסברים הקצרים יופיעו לאורך הדרך.' : 'נשמר');
                if (v === 'beginner') dispatch(D.resetTips());
              }} /><span>{l}</span></label>
            ))}
          </span>
        </div>
        <div className="set-row">
          <label htmlFor="s-focus2">מה הכי חשוב לך<span className="hint">מופיע בברכה במסך הראשי</span></label>
          <select id="s-focus2" className="field" value={s.focus || ''} onChange={(e) => setSetting('focus', e.target.value)}>
            <option value="" disabled>בחירה…</option>
            <option value="spend">להפסיק לחרוג</option>
            <option value="save">לחסוך למשהו</option>
            <option value="understand">להבין לאן הכסף הולך</option>
            <option value="invest">להתחיל להשקיע</option>
          </select>
        </div>
        <button type="button" className="link" onClick={() => { dispatch(D.resetTips()); dispatch(D.resetTours()); dispatch(D.setSetting({ key: 'stepsDismissed', value: false })); toast('ההסברים וההדרכות יופיעו שוב'); }}>להציג שוב את ההסברים וההדרכות</button>
      </section>

      <section aria-labelledby="sb-h" className="set-group">
        <div className="sec-head"><h2 className="sec-title" id="sb-h">תקציבים</h2></div>
        <div className="set-row">
          <label htmlFor="s-total">תקציב חודשי כולל<span className="hint">{s.monthlyBudget ? 'הסכום שמותר להוציא בחודש' : `ריק = סכום המעטפות (${money(derived, { round: true })})`}</span></label>
          <MoneyInput id="s-total" value={s.monthlyBudget} placeholder={derived / 100 || '—'}
            onCommit={(a) => setSetting('monthlyBudget', a)} onBad={() => toast('צריך מספר, למשל 3500', { alert: true })} />
        </div>
        <p className="block-p">תקציב לכל קטגוריה. השאירו ריק לקטגוריה שרק עוקבים אחריה.</p>
        <div id="cat-edit-list">
          {active.map((c) => (
            <div className="cat-edit" key={c.id}>
              <button type="button" className="swatch" style={{ background: c.color }} aria-label={`החלפת צבע ל${c.name}`} onClick={() => dispatch(D.cycleColor(c.id))} />
              <input className="field" key={`n${c.name}`} defaultValue={c.name} aria-label="שם הקטגוריה" maxLength={30}
                onBlur={(e) => {
                  const name = e.target.value.trim().slice(0, 30);
                  if (!name) e.target.value = c.name;
                  else if (name !== c.name) dispatch(D.updateCategory({ id: c.id, changes: { name } }));
                }} />
              <MoneyInput className="field money" value={c.budget} placeholder="—" aria-label={`תקציב חודשי ל${c.name}`}
                onBad={() => toast(`התקציב של ${c.name} צריך להיות מספר`, { alert: true })}
                onCommit={(a) => {
                  dispatch(D.updateCategory({ id: c.id, changes: { budget: a } }));
                  toast(`${c.name}: ${a ? `${money(a)} בחודש` : 'בלי תקציב'}`);
                }} />
              <button type="button" className="x" aria-label={`הסרת ${c.name}`} onClick={() => delCat(c)}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="link" onClick={act.openCategory}>קטגוריה חדשה</button>
        {cats.some((c) => c.archived) && (
          <p className="small muted">בארכיון: {cats.filter((c) => c.archived).map((c, i) => (
            <span key={c.id}>{i > 0 && ' · '}{c.name} <button type="button" className="link small" onClick={() => dispatch(D.updateCategory({ id: c.id, changes: { archived: false } }))}>החזרה</button></span>
          ))}</p>
        )}
      </section>

      <section aria-labelledby="sa-h" className="set-group">
        <div className="sec-head"><h2 className="sec-title" id="sa-h">התראות ומחזור</h2></div>
        <div className="set-row">
          <label htmlFor="s-focus">קטגוריה במרכז המסך<span className="hint">מקבלת מקום של כבוד במסך הבית</span></label>
          <select id="s-focus" className="field" value={fc?.id || ''} onChange={(e) => setSetting('focusCatId', e.target.value)}>
            {active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="set-row">
          <label htmlFor="s-alert">להזהיר כשמגיעים ל<span className="hint">אחוז מהתקציב של קטגוריה</span></label>
          <select id="s-alert" className="field" value={s.alertAt} onChange={(e) => setSetting('alertAt', Number(e.target.value))}>
            {[0.6, 0.7, 0.8, 0.9].map((v) => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}
          </select>
        </div>
        <div className="set-row">
          <span className="label" id="s-confirm-l">לעצור לפני חריגה<span className="hint">שואל ״בטוח?״ לפני שהוצאה עוברת את התקציב</span></span>
          <span className="switch"><input type="checkbox" id="s-confirm" aria-labelledby="s-confirm-l" checked={!!s.confirmOver} onChange={(e) => setSetting('confirmOver', e.target.checked)} /><span /></span>
        </div>
        <div className="set-row">
          <label htmlFor="s-day">המחזור מתחיל ב<span className="hint">למשל ביום שהמשכורת נכנסת</span></label>
          <select id="s-day" className="field" value={s.cycleDay} onChange={(e) => setSetting('cycleDay', L.clampCycleDay(e.target.value))}>
            {days28.map((d) => <option key={d} value={d}>{d} בחודש</option>)}
          </select>
        </div>
        <div className="set-row">
          <label htmlFor="s-ci">צ׳ק־אין חודשי ב<span className="hint">הכנסה, עו״ש והשקעות</span></label>
          <select id="s-ci" className="field" value={s.checkInDay} onChange={(e) => setSetting('checkInDay', L.clampCycleDay(e.target.value))}>
            {days28.map((d) => <option key={d} value={d}>{d} בחודש</option>)}
          </select>
        </div>
        <div className="reminder-box">
          <p><strong>תזכורת באייפון</strong> — אירוע חוזר ביומן, עם התראה ב־9:00 ביום הצ׳ק־אין{s.cycleDay !== s.checkInDay ? ' וביום שהסיכום החודשי מוכן' : ''}.</p>
          <button type="button" className="btn btn-line btn-small" onClick={act.reminder}>הוספה ליומן</button>
          <p className="small muted">אם לא נפתח חלון של היומן: פותחים את שקל בצד בספארי ולוחצים שוב. או יוצרים ביומן אירוע ״חוזר כל חודש״ ב־{s.checkInDay} לחודש.</p>
        </div>
        <div className="set-row">
          <label htmlFor="s-wait">זמן המתנה ברשימה<span className="hint">לפני קנייה לא מתוכננת</span></label>
          <select id="s-wait" className="field" value={s.waitHours} onChange={(e) => setSetting('waitHours', Number(e.target.value))}>
            {[[24, 'יום'], [48, 'יומיים'], [72, '3 ימים'], [168, 'שבוע']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </section>

      <section aria-labelledby="sr-h" className="set-group" id="recurring-section">
        <div className="sec-head"><h2 className="sec-title" id="sr-h">הוצאות קבועות</h2><button type="button" className="link" onClick={() => act.openRecurring()}>להוסיף</button></div>
        {state.recurring.length ? (
          <ul className="plain-list" style={{ marginBottom: 0 }}>
            {state.recurring.map((r) => (
              <li key={r.id}>
                <span>{r.name} <span className="small muted">· {r.day} בחודש · {catById(r.catId)?.name || ''}{r.active ? '' : ' · מושהה'}</span></span>
                <span><M a={r.amount} /> <button type="button" className="link small" aria-label={`עריכת ${r.name}`} onClick={() => act.openRecurring(r)}>עריכה</button></span>
              </li>
            ))}
          </ul>
        ) : <p className="block-p">אין עדיין. שכירות, חשמל, מנויים — נרשמים לבד כל חודש ביום שבחרתם.</p>}
      </section>

      <section aria-labelledby="ss-h" className="set-group" id="spreads-section">
        <div className="sec-head"><h2 className="sec-title" id="ss-h">ביטוחים והוצאות שנתיות</h2><button type="button" className="link" onClick={() => act.openSpread()}>להוסיף</button></div>
        {spreads.length ? (
          <ul className="plain-list" style={{ marginBottom: 0 }}>
            {spreads.map((sp) => {
              const info = L.spreadInfo(sp, t);
              return (
                <li key={sp.id}>
                  <span>{sp.name} <span className="small muted">· {money(sp.total, { round: true })} ל־{sp.months} חודשים · {info.active ? `${Math.min(info.passed, sp.months)}/${sp.months}` : 'הסתיים'}</span></span>
                  <span><M a={info.monthly} /><span className="small muted"> לחודש</span> <button type="button" className="link small" aria-label={`עריכת ${sp.name}`} onClick={() => act.openSpread(sp)}>עריכה</button></span>
                </li>
              );
            })}
          </ul>
        ) : <p className="block-p">ביטוח רכב, ביטוח דירה, אגרת רישוי, מנוי שנתי — סכום אחד שמתחלק שווה בשווה על כל החודשים.</p>}
      </section>

      <section aria-labelledby="spl-h" className="set-group">
        <div className="sec-head"><h2 className="sec-title" id="spl-h">מקומות שזכרתי</h2></div>
        <p className="block-p">אחרי {L.MIN_PLACE_COUNT} הוצאות עם אותו שם, שקל בצד זוכר את המקום: מציע אותו בהקלדה ובוחר לבד את הקטגוריה.</p>
        {places.length ? places.map((p) => (
          <div className="place-edit" key={p.key}>
            <span className="place-name">{p.name}<span className="hint">{p.count} פעמים · {money(p.total, { round: true })}</span></span>
            <label className="sr-only" htmlFor={`pc-${p.key}`}>קטגוריה ל{p.name}</label>
            <select className="field" id={`pc-${p.key}`} value={p.catId} onChange={(e) => {
              dispatch(D.setPlacePref({ key: p.key, pref: { catId: e.target.value, hidden: false } }));
              toast(`מעכשיו: ${catById(e.target.value)?.name}`);
            }}>
              {active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" className="x" aria-label={`לשכוח את ${p.name}`} onClick={() => forget(p.key)}>✕</button>
          </div>
        )) : <p className="small muted">עוד אין מקומות. הם יופיעו כאן לבד.</p>}
        {hidden.length > 0 && (
          <p className="small muted">נשכחו: {hidden.map((k, i) => (
            <span key={k}>{i > 0 && ' · '}{k} <button type="button" className="link small" onClick={() => dispatch(D.setPlacePref({ key: k, pref: { hidden: false } }))}>החזרה</button></span>
          ))}</p>
        )}
      </section>

      <section aria-labelledby="sg-h" className="set-group">
        <div className="sec-head"><h2 className="sec-title" id="sg-h">כללי</h2></div>
        <div className="set-row">
          <span className="label" id="theme-l">מראה</span>
          <span className="seg" role="radiogroup" aria-labelledby="theme-l">
            {[['auto', 'כמו בטלפון'], ['light', 'בהיר'], ['dark', 'כהה']].map(([v, l]) => (
              <label key={v}><input type="radio" name="theme" value={v} checked={s.theme === v} onChange={() => setSetting('theme', v)} /><span>{l}</span></label>
            ))}
          </span>
        </div>
        <div className="set-row">
          <label htmlFor="s-income">הכנסה חודשית<span className="hint">לא חובה. לחישוב כמה נשאר</span></label>
          <MoneyInput id="s-income" value={s.income} placeholder="—" onCommit={(a) => setSetting('income', a)} onBad={() => toast('צריך מספר, למשל 3500', { alert: true })} />
        </div>
        <div className="set-row">
          <label htmlFor="s-cur">סימן מטבע</label>
          <input id="s-cur" className="field" key={s.currency} defaultValue={s.currency} maxLength={4}
            onBlur={(e) => {
              const v = e.target.value.trim().slice(0, 4) || '₪';
              e.target.value = v;
              if (v !== s.currency) setSetting('currency', v);
            }} />
        </div>
        <div className="set-row">
          <label htmlFor="s-bank">הבנק שלך<span className="hint">לשמות השדות בצ׳ק־אין ולהשוואת עמלות</span></label>
          <select id="s-bank" className="field" value={s.bank || ''} onChange={(e) => setSetting('bank', e.target.value)}>
            <option value="">לא נבחר</option>
            {L.BANKS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </section>

      <section aria-labelledby="sd-h" className="set-group">
        <div className="sec-head"><h2 className="sec-title" id="sd-h">הנתונים שלך</h2></div>
        <p className="block-p">הכול נשמר רק בטלפון הזה — בלי שרת, בלי חשבון, בלי שאף אחד אחר רואה. לכן כדאי לשמור גיבוי פעם בחודש (לקבצים או לאייקלאוד).{s.lastBackupAt ? ` גיבוי אחרון: ${new Date(s.lastBackupAt).toLocaleDateString('he-IL')}.` : ''}</p>
        <div className="data-actions">
          <button type="button" className="btn btn-primary" onClick={act.backup}>שמירת גיבוי</button>
          <button type="button" className="btn btn-line" onClick={() => fileRef.current?.click()}>שחזור מגיבוי</button>
          <button type="button" className="btn btn-line" onClick={() => shareOrDownload(`pinkas-${t}.csv`, L.toCSV(state), 'text/csv')}>ייצוא לאקסל (CSV)</button>
          <button type="button" className="btn btn-danger-quiet" onClick={act.wipe}>מחיקת כל הנתונים</button>
        </div>
        <input type="file" ref={fileRef} accept="application/json,.json" hidden aria-label="קובץ גיבוי"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) act.restore(f); }} />
      </section>

      <section aria-labelledby="sx-h" className="set-group">
        <div className="sec-head"><h2 className="sec-title" id="sx-h">שקל בצד</h2></div>
        <div className="data-actions">
          <button type="button" className="btn btn-primary" onClick={act.share}>שליחה לחבר</button>
          <button type="button" className="btn btn-line" onClick={() => { dispatch(U.setInstall({ show: true })); window.scrollTo(0, 0); }}>איך מתקינים (אייפון ואנדרואיד)</button>
          <button type="button" className="btn btn-line" onClick={() => act.showWhatsNew(true)}>מה חדש בגרסה</button>
          <button type="button" className="btn btn-line" onClick={() => onTour?.('settings')}>סיור קצר באפליקציה</button>
        </div>
      </section>

      <section className="about">
        <p>שקל בצד {VERSION} · עובד גם בלי אינטרנט · הנתונים נשמרים רק במכשיר</p>
      </section>
    </>
  );
}
