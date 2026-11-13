// Transient UI that any component can open: toast, sheets, story, celebration, streak, guides.
// (Saved data lives in Redux; this is only "what is on screen right now".)
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const UiCtx = createContext(null);
export const useOverlay = () => useContext(UiCtx);

export function UiProvider({ children }) {
  const [toastState, setToastState] = useState(null);
  const [form, setForm] = useState(null);
  const [add, setAdd] = useState(null);
  const [story, setStory] = useState(null);
  const [celebrate, setCelebrate] = useState(null);
  const [welcome, setWelcome] = useState(false);
  const [streakFx, setStreakFx] = useState(false);
  const [streakMonth, setStreakMonth] = useState(null);
  const [tour, setTour] = useState(null);
  const [piggyFrom, setPiggyFrom] = useState(null);
  const timer = useRef(null);
  const formKey = useRef(0);

  const toast = useCallback((msg, { action, onAction, alert = false, ms } = {}) => {
    clearTimeout(timer.current);
    setToastState({ msg, action, onAction, alert, id: Date.now() });
    timer.current = setTimeout(() => setToastState(null), ms || (action ? 6000 : alert ? 6500 : 3500));
  }, []);
  const hideToast = useCallback(() => setToastState(null), []);

  const value = useMemo(() => ({
    toast, hideToast, toastState,
    form, openForm: (cfg) => setForm({ ...cfg, key: ++formKey.current }), closeForm: () => setForm(null),
    add, openAdd: (opts = {}) => setAdd({ ...opts, key: Date.now() }), closeAdd: () => setAdd(null),
    story, openStory: (cycle) => setStory(cycle), closeStory: () => setStory(null),
    celebrate, openCelebrate: (goal) => setCelebrate(goal), closeCelebrate: () => setCelebrate(null),
    welcome, setWelcome,
    streakFx, setStreakFx,
    streakMonth, openStreak: (m) => setStreakMonth(m), closeStreak: () => setStreakMonth(null),
    tour, startTour: (t) => setTour(t), endTour: () => setTour(null),
    piggyFrom, setPiggyFrom,
    // anything covering the screen? (the startup sequence waits for it)
    busy: !!(form || add || story || celebrate || welcome || streakFx || streakMonth || tour),
  }), [toast, hideToast, toastState, form, add, story, celebrate, welcome, streakFx, streakMonth, tour, piggyFrom]);

  return <UiCtx.Provider value={value}>{children}</UiCtx.Provider>;
}

export function Toast() {
  const { toastState, hideToast } = useOverlay();
  if (!toastState) return <div className="toast" role="status" aria-live="polite" hidden />;
  const { msg, action, onAction, alert } = toastState;
  return (
    <div className={`toast ${alert ? 'is-alert' : ''}`} role={alert ? 'alert' : 'status'} aria-live="polite" key={toastState.id}>
      <p className="toast-msg">{msg}</p>
      {action && (
        <button type="button" className="toast-action" onClick={() => { hideToast(); onAction?.(); }}>{action}</button>
      )}
    </div>
  );
}
