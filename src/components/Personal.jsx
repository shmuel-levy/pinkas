// Home-page pieces that talk to the person: a greeting, first steps for beginners, an invitation to say who you are.
import { useDispatch } from 'react-redux';
import { firstSteps, greeting, personalLine, showFirstSteps } from '../lib/personal.js';
import { isStandalone } from '../lib/platform.js';
import { useData, useMoney, today } from '../hooks/useApp.js';
import { useActions } from '../hooks/useActions.jsx';
import { D } from '../store/dataSlice.js';
import { U } from '../store/uiSlice.js';
import { useOverlay } from './UiProvider.jsx';
import { budgetAnswers } from '../pages/QuizPage.jsx';

export function Hello() {
  const state = useData();
  const money = useMoney();
  const name = state.settings.name;
  const hi = greeting(new Date().getHours());
  return (
    <div className="hello">
      <p className="hello-h">{name ? `${hi}, ${name}` : hi}</p>
      <p className="hello-p">{personalLine(state, today(), (a) => money(a, { round: true }))}</p>
    </div>
  );
}

const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

export function FirstSteps() {
  const state = useData();
  const dispatch = useDispatch();
  const act = useActions();
  const { openAdd } = useOverlay();
  const opts = { installed: isStandalone() };
  if (!showFirstSteps(state, opts)) return null;
  const steps = firstSteps(state, opts);
  const done = steps.filter((s) => s.done).length;
  const run = {
    expense: () => openAdd(),
    budget: () => dispatch(U.startQuiz({ id: 'budget', answers: budgetAnswers(state) })),
    goal: () => act.openGoal(),
    checkin: () => act.openCheckIn(),
    install: () => { dispatch(U.setInstall({ show: true })); window.scrollTo(0, 0); },
  };
  return (
    <section className="steps-card" aria-labelledby="steps-h">
      <div className="steps-top">
        <h2 className="steps-title" id="steps-h">הצעדים הראשונים שלך</h2>
        <span className="small muted">{done} מתוך {steps.length}</span>
      </div>
      <p className="small muted">{done === 0 ? 'לא צריך הכל היום. מתחילים מהראשון.' : 'כל הכבוד, ממשיכים. כל צעד לוקח פחות מדקה.'}</p>
      <div className="steps-meter" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label={`${done} מתוך ${steps.length} צעדים`}>
        <span style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="steps-list">
        {steps.map((s) => (
          <li key={s.key} className={s.done ? 'is-done' : ''}>
            <button type="button" className="step-btn" disabled={s.done} onClick={run[s.key]} aria-label={`${s.title}${s.done ? ' — בוצע' : ''}`}>
              <span className="step-check">{s.done && <Check />}</span>
              <span><span className="step-t">{s.title}</span>{!s.done && <span className="step-s">{s.text}</span>}</span>
              {!s.done && <span className="step-go" aria-hidden="true">←</span>}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="link small" onClick={() => dispatch(D.setSetting({ key: 'stepsDismissed', value: true }))}>להסתיר את הרשימה</button>
    </section>
  );
}

// For people who started before the profile questions existed
export function AskProfile() {
  const state = useData();
  const dispatch = useDispatch();
  if (state.settings.level || state.settings.tipsSeen?.['profile-ask']) return null;
  return (
    <section className="steps-card" aria-labelledby="ask-h">
      <h2 className="steps-title" id="ask-h">ספר/י לי קצת על עצמך</h2>
      <p className="small muted" style={{ margin: '4px 0 12px' }}>3 שאלות קצרות — איך לקרוא לך, כמה ניסיון יש לך ומה הכי חשוב לך — והאפליקציה תתאים את עצמה אליך.</p>
      <div className="data-actions">
        <button type="button" className="btn btn-primary btn-small" onClick={() => dispatch(U.startQuiz({ id: 'profile' }))}>בואו נתחיל</button>
        <button type="button" className="link small" onClick={() => dispatch(D.markTipSeen('profile-ask'))}>לא עכשיו</button>
      </div>
    </section>
  );
}
