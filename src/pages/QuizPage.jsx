// One question per screen, each with "why we ask". Used for the first run (checking balance) and the budget setup.
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import * as L from '../lib/logic.js';
import { QUIZZES, SUGGEST, VERSION } from '../lib/content.js';
import { useData, useUi, today } from '../hooks/useApp.js';
import { D } from '../store/dataSlice.js';
import { U } from '../store/uiSlice.js';
import { useOverlay } from '../components/UiProvider.jsx';
import { M } from '../components/ui.jsx';
import { tick } from '../lib/fx.js';

export function budgetAnswers(state) {
  return {
    income: state.settings.income,
    total: state.settings.monthlyBudget,
    food: state.categories.find((c) => c.name === 'אוכל בחוץ')?.budget,
    day: state.settings.cycleDay,
  };
}

function MoneyStep({ step, answers, last, onNext }) {
  const state = useData();
  const sug = step.suggest ? SUGGEST[step.suggest](answers) : 0;
  const [vals, setVals] = useState(() => Object.fromEntries(step.fields.map((f) => [f.name, answers[f.name] ? String(answers[f.name] / 100) : ''])));
  const [bank, setBank] = useState(answers.bank || '');
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(null);
  const refs = useRef({});
  useEffect(() => { refs.current[step.fields[0].name]?.focus({ preventScroll: true }); }, [step]);

  const next = () => {
    const out = {};
    for (const f of step.fields) {
      const raw = vals[f.name].trim();
      const v = raw ? L.parseAmount(raw) : 0;
      if (v === null || (f.required && !v)) {
        setError(v === null ? 'צריך מספר, למשל 4500 או 4,500.50' : `חסר סכום ב״${f.label}״.`);
        setInvalid(f.name);
        refs.current[f.name]?.focus();
        return;
      }
      out[f.name] = v;
    }
    if (step.bank) out.bank = bank;
    onNext(out);
  };

  return (
    <>
      {step.fields.map((f, i) => (
        <div className="form-field" key={f.name}>
          <label htmlFor={`qz-${f.name}`}>{f.label}</label>
          <div className={`money-field ${f.big ? 'is-big' : ''}`}>
            <input className="field" id={`qz-${f.name}`} inputMode="decimal" autoComplete="off" ref={(el) => { refs.current[f.name] = el; }}
              aria-invalid={invalid === f.name ? 'true' : undefined} value={vals[f.name]}
              placeholder={f.placeholder || (sug && i === 0 ? String(sug / 100) : '0')}
              onChange={(e) => setVals((v) => ({ ...v, [f.name]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } }} />
            <span className="cur" aria-hidden="true">{state.settings.currency}</span>
          </div>
        </div>
      ))}
      {sug > 0 && (
        <button type="button" className="quiz-suggest" onClick={() => {
          setVals((v) => ({ ...v, [step.fields[0].name]: String(sug / 100) }));
          refs.current[step.fields[0].name]?.focus();
        }}>הצעה: <M a={sug} round /></button>
      )}
      {step.bank && (
        <div className="form-field">
          <label htmlFor="qz-bank">באיזה בנק? (לא חובה)</label>
          <select id="qz-bank" className="field" value={bank} onChange={(e) => setBank(e.target.value)}>
            <option value="">לא לבחור</option>
            {L.BANKS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}
      <p className="form-error" role="alert">{error}</p>
      <button type="button" className="btn btn-primary quiz-next" onClick={next}>{step.next || (last ? 'סיום' : 'המשך')}</button>
    </>
  );
}

// Free text (the name). Optional: an empty answer is fine.
function TextStep({ step, answers, onNext }) {
  const [v, setV] = useState(answers[step.key] || '');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, [step]);
  const next = () => onNext({ [step.key]: v.trim().slice(0, 24) });
  return (
    <>
      <div className="form-field">
        <label htmlFor={`qz-${step.key}`}>{step.label}</label>
        <input id={`qz-${step.key}`} ref={ref} className="field quiz-text" maxLength={24} autoComplete="given-name" value={v} placeholder={step.placeholder || ''}
          onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } }} />
      </div>
      <button type="button" className="btn btn-primary quiz-next" onClick={next}>{v.trim() ? 'המשך' : 'המשך בלי שם'}</button>
    </>
  );
}

function ChoiceStep({ step, answers, onPick }) {
  const first = useRef(null);
  useEffect(() => { first.current?.focus({ preventScroll: true }); }, [step]);
  return (
    <>
      <div className="inv-options" role="radiogroup" aria-label={titleOf(step, answers)}>
        {step.options.map(([v, l, sub], i) => (
          <button key={v} ref={i === 0 ? first : undefined} type="button" className="inv-option" role="radio" aria-checked={String(answers[step.key]) === String(v)}
            onClick={() => { tick(8); onPick({ [step.key]: v }); }}>
            <span className="inv-option-l">{l}</span>{sub && <span className="inv-option-s">{sub}</span>}
          </button>
        ))}
      </div>
      {step.other && (
        <div className="form-field">
          <label htmlFor="qz-other">יום אחר</label>
          <select id="qz-other" className="field" defaultValue="" onChange={(e) => e.target.value && onPick({ [step.key]: Number(e.target.value) })}>
            <option value="">בחירה…</option>
            {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} בחודש</option>)}
          </select>
        </div>
      )}
    </>
  );
}

const titleOf = (step, answers) => (typeof step.title === 'function' ? step.title(answers) : step.title);
const profileOf = (a) => ({ name: (a.name || '').trim(), level: a.level || 'some', focus: a.focus || 'spend' });

export function QuizPage({ onStartDone }) {
  const state = useData();
  const { quiz } = useUi();
  const dispatch = useDispatch();
  const { toast } = useOverlay();
  const steps = QUIZZES[quiz.id];
  const step = steps[quiz.step];
  const n = steps.length;

  const finish = (a) => {
    if (quiz.id === 'start') {
      dispatch(D.setBalanceAnchor({ checking: a.checking, cash: a.cash }));
      dispatch(D.mergeSettings({
        ...profileOf(a),
        bank: a.bank || '',
        lastSeenVersion: VERSION, // new users don't need "what's new"
        tourDone: true,
        checkInPrompted: L.checkInStatus(state, today()).period, // no check-in right after this
      }));
      dispatch(D.setOnboarded());
      dispatch(D.recordVisit(today()));
      dispatch(U.endQuiz());
      dispatch(U.goTab('home'));
      onStartDone?.();
      return;
    }
    if (quiz.id === 'profile') {
      const prof = profileOf(a);
      dispatch(D.mergeSettings({ ...prof, stepsDismissed: false }));
      if (prof.level === 'beginner') { dispatch(D.resetTips()); dispatch(D.resetTours()); }
      dispatch(U.endQuiz());
      window.scrollTo(0, 0);
      toast(`תודה${prof.name ? `, ${prof.name}` : ''}. התאמתי את האפליקציה בשבילך.`);
      return;
    }
    if (a.income) dispatch(D.setSetting({ key: 'income', value: a.income }));
    dispatch(D.setSetting({ key: 'monthlyBudget', value: a.total || 0 }));
    const food = state.categories.find((c) => c.name === 'אוכל בחוץ');
    if (food && a.food !== undefined) dispatch(D.updateCategory({ id: food.id, changes: { budget: a.food } }));
    dispatch(D.setSetting({ key: 'cycleDay', value: L.clampCycleDay(a.day || 1) }));
    dispatch(U.endQuiz());
    window.scrollTo(0, 0);
    toast('התקציב מוכן. מעכשיו רואים כאן כמה מותר להוציא כל יום.');
  };

  const advance = (patch) => {
    const answers = { ...quiz.answers, ...patch };
    dispatch(U.quizAnswer(patch));
    if (quiz.step < n - 1) {
      dispatch(U.quizStep(1));
      window.scrollTo(0, 0);
    } else finish(answers);
  };
  const back = () => {
    if (quiz.step > 0) dispatch(U.quizStep(-1));
    else dispatch(U.endQuiz());
  };

  return (
    <section className="quiz">
      {quiz.id === 'start' && <div className="quiz-brand"><img src="icons/icon-192.png" alt="" width="44" height="44" /><span>שקל בצד</span></div>}
      {n > 1 && (
        <>
          <div className="inv-progress" role="progressbar" aria-valuemin={1} aria-valuemax={n} aria-valuenow={quiz.step + 1} aria-label={`שאלה ${quiz.step + 1} מתוך ${n}`}>
            {steps.map((s, i) => <span key={i} className={i <= quiz.step ? 'on' : ''} />)}
          </div>
          <p className="eyebrow">שאלה {quiz.step + 1} מתוך {n}</p>
        </>
      )}
      <h2 className="inv-q-title quiz-title">{titleOf(step, quiz.answers)}</h2>
      <p className="inv-why"><span>למה שואלים?</span> {step.why}</p>
      {step.kind === 'money'
        ? <MoneyStep key={`${quiz.id}-${quiz.step}`} step={step} answers={quiz.answers} last={quiz.step === n - 1} onNext={advance} />
        : step.kind === 'text'
        ? <TextStep key={`${quiz.id}-${quiz.step}`} step={step} answers={quiz.answers} onNext={advance} />
        : <ChoiceStep key={`${quiz.id}-${quiz.step}`} step={step} answers={quiz.answers} onPick={advance} />}
      {(quiz.step > 0 || state.onboarded) && <button type="button" className="link" onClick={back}>{quiz.step > 0 ? 'חזרה לשאלה הקודמת' : 'ביטול'}</button>}
    </section>
  );
}
