// The app shell: header, current page, tab bar, overlays — and the startup sequence
// (welcome → what's new → this page's guide → today's streak → monthly check-in), one thing at a time.
import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useStore } from 'react-redux';
import * as L from './lib/logic.js';
import { PAGE_TOURS } from './lib/content.js';
import { fetchUsdRate } from './lib/rate.js';
import { load } from './lib/storage.js';
import { tick } from './lib/fx.js';
import { useData, useUi, daysWord, today } from './hooks/useApp.js';
import { useActions } from './hooks/useActions.jsx';
import { D } from './store/dataSlice.js';
import { U } from './store/uiSlice.js';
import { Toast, useOverlay } from './components/UiProvider.jsx';
import { FormSheet } from './sheets/FormSheet.jsx';
import { AddSheet } from './sheets/AddSheet.jsx';
import { Story } from './components/Story.jsx';
import { Celebrate, StreakFx, StreakSheet, Tour, Welcome } from './components/Overlays.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LedgerPage } from './pages/LedgerPage.jsx';
import { SavePage } from './pages/SavePage.jsx';
import { InvestPage } from './pages/InvestPage.jsx';
import { InsightsPage } from './pages/InsightsPage.jsx';
import { ReportPage } from './pages/ReportPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { QuizPage } from './pages/QuizPage.jsx';
import { InstallPage } from './pages/InstallPage.jsx';

const TITLES = { settings: 'הגדרות', report: 'סיכום חודשי', insights: 'תובנות', quiz: 'הגדרת תקציב' };
const TAB_TITLES = { home: 'ראשי', ledger: 'יומן', save: 'חיסכון', invest: 'השקעות' };
const PAGES = { home: HomePage, ledger: LedgerPage, save: SavePage, invest: InvestPage };

// which page guide belongs to what's on screen (none for the report or a questionnaire)
const guideKey = (ui) => (ui.sub === 'settings' || ui.sub === 'insights' ? ui.sub : ui.sub ? null : ui.tab);

const TABS = [
  ['home', 'ראשי', <path key="p" d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />],
  ['ledger', 'יומן', <g key="g"><path d="M8 7h11M8 12h11M8 17h11" /><circle cx="4.5" cy="7" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="17" r="1" /></g>],
  ['save', 'חיסכון', <g key="g"><ellipse cx="11" cy="13" rx="7.5" ry="5.5" /><path d="M18 11.5h2v3h-2M8 18.5v1.5M14 18.5v1.5M9.5 7.6h3" /></g>],
  ['invest', 'השקעות', <g key="g"><path d="M3.5 17l5.5-5.5 4 4 7-8" /><path d="M15 7.5h5v5" /></g>],
];

function TabButton({ tab, label, icon, current, go }) {
  return (
    <button type="button" data-tab={tab} aria-current={current ? 'page' : undefined} onClick={() => go(tab)}>
      <svg className="tab-ic" viewBox="0 0 24 24" aria-hidden="true">{icon}</svg><span>{label}</span>
    </button>
  );
}

export default function App() {
  const state = useData();
  const ui = useUi();
  const dispatch = useDispatch();
  const store = useStore();
  const ov = useOverlay();
  const act = useActions();
  const ovRef = useRef(ov);
  ovRef.current = ov;
  const actRef = useRef(act);
  actRef.current = act;
  const view = useRef(null);
  const t = today();

  // before the app proper: install guide (shared link on a phone) → the first question
  const pre = ui.showInstall ? 'install' : !state.onboarded ? 'quiz' : null;
  useEffect(() => {
    if (!state.onboarded && !ui.showInstall && ui.quiz?.id !== 'start') dispatch(U.startQuiz({ id: 'start' }));
  }, [state.onboarded, ui.showInstall, ui.quiz, dispatch]);

  const sub = ui.quiz ? 'quiz' : ui.sub;
  const pageKey = pre || sub || ui.tab;

  /* ---------- theme ---------- */
  useEffect(() => {
    if (state.settings.theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  useEffect(() => {
    document.title = pre ? 'פנקס' : `${TITLES[sub] || TAB_TITLES[ui.tab]} · פנקס`;
  }, [pre, sub, ui.tab]);

  /* ---------- the startup sequence ---------- */
  const runPageTour = useCallback((key, force = false) => {
    const s = store.getState().data;
    const steps = PAGE_TOURS[key];
    if (!steps || (!force && s.settings.toursSeen?.[key]) || ovRef.current.tour) return false;
    ovRef.current.startTour({ id: Date.now(), key, steps, mandatory: 3 });
    return true;
  }, [store]);

  const maybePromptCheckIn = useCallback(() => {
    const s = store.getState().data;
    const ci = L.checkInStatus(s, today());
    if (!ci.due || s.settings.checkInPrompted === ci.period) return;
    // when the monthly story is waiting, its floating button leads; the story ends with the check-in
    if (L.pendingStory(s, today())) return;
    dispatch(D.setSetting({ key: 'checkInPrompted', value: ci.period }));
    setTimeout(() => actRef.current.openCheckIn(ci.period), 450);
  }, [store, dispatch]);

  const nextBoot = useCallback(() => {
    const { data, ui: u } = store.getState();
    const o = ovRef.current;
    if (!data.onboarded || u.showInstall || o.busy) return;
    if (u.welcomePending) {
      dispatch(U.setWelcomePending(false));
      o.setWelcome(true);
      return;
    }
    if (actRef.current.showWhatsNew()) return;
    const page = guideKey(u);
    if (page && runPageTour(page)) return;
    if (data.settings.streakShown !== today() && data.visits.includes(today())) {
      o.setStreakFx(true);
      return;
    }
    maybePromptCheckIn();
  }, [store, dispatch, runPageTour, maybePromptCheckIn]);

  // Whenever nothing covers the screen (first load, a page change, a sheet just closed), take the next step.
  const first = useRef(true);
  useEffect(() => {
    if (ov.busy || pre) return undefined;
    const id = setTimeout(nextBoot, first.current ? 700 : 450);
    first.current = false;
    return () => clearTimeout(id);
  }, [ov.busy, pre, pageKey, nextBoot]);

  /* ---------- a new day: fixed charges, spread shares, the streak ---------- */
  const refreshDay = useCallback(() => {
    dispatch(D.syncSpreads());
    dispatch(D.applyRecurring(today()));
    if (store.getState().data.onboarded) dispatch(D.recordVisit(today()));
  }, [dispatch, store]);

  useEffect(() => {
    refreshDay();
    // a home-screen shortcut / link straight to "add"
    const params = new URLSearchParams(location.search);
    if (store.getState().data.onboarded && (params.get('action') === 'add' || location.hash === '#add')) {
      history.replaceState(null, '', location.pathname);
      ovRef.current.openAdd();
    }
    let lastDay = today();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (today() !== lastDay) {
        lastDay = today();
        refreshDay();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    // other tabs/windows editing the same data
    const onStorage = (ev) => {
      if (ev.key === 'pinkas.v1' && ev.newValue) {
        dispatch(D.replaceAll(load()));
      }
    };
    addEventListener('storage', onStorage);
    const onSaveFailed = () => ovRef.current.toast('השמירה במכשיר נכשלה. כדאי לייצא גיבוי מההגדרות.', { alert: true });
    addEventListener('pinkas:save-failed', onSaveFailed);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      removeEventListener('storage', onStorage);
      removeEventListener('pinkas:save-failed', onSaveFailed);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the dollar rate fresh (once a day; only the rate is requested — no personal data)
  useEffect(() => {
    if (state.settings.usdRate?.date === t) return;
    fetchUsdRate().then((rate) => {
      if (rate) dispatch(D.setSetting({ key: 'usdRate', value: { rate, date: today() } }));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- navigation ---------- */
  const go = (tab) => {
    dispatch(U.goTab(tab));
    window.scrollTo(0, 0);
    view.current?.focus({ preventScroll: true });
  };
  const back = () => {
    dispatch(U.closeSub());
    window.scrollTo(0, 0);
  };
  const openSettings = () => {
    dispatch(U.openSub({ sub: 'settings' }));
    window.scrollTo(0, 0);
    view.current?.focus({ preventScroll: true });
  };

  const cycle = L.cycleFor(t, state.settings.cycleDay);
  const story = !pre && L.pendingStory(state, t);
  const streak = L.streakCount(state.visits, t);

  let page;
  if (pre === 'install') page = <InstallPage />;
  else if (sub === 'quiz' && ui.quiz) page = <QuizPage onStartDone={() => dispatch(U.setWelcomePending(true))} />;
  else if (sub === 'settings') page = <SettingsPage onTour={(k) => runPageTour(k, true)} />;
  else if (sub === 'report') page = <ReportPage />;
  else if (sub === 'insights') page = <InsightsPage />;
  else {
    const Page = PAGES[ui.tab] || HomePage;
    page = <Page />;
  }

  return (
    <>
      <a className="skip" href="#view">דילוג לתוכן</a>
      <div className="app" id="app">
        {!pre && (
          <header className="top" id="top">
            <div className="top-row">
              {sub && <button className="back" id="btn-back" type="button" onClick={back}><span aria-hidden="true">→</span> חזרה</button>}
              <h1 className="brand" id="brand">{TITLES[sub] || 'פנקס'}</h1>
              <div className="top-actions">
                {!sub && streak > 0 && (
                  <button type="button" className="streak-chip" id="streak-chip" aria-label={`רצף של ${streak} ימים. פתיחת לוח הרצף`} onClick={() => ov.openStreak(L.monthKey(t))}>
                    <svg className="flame" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2.5c.6 3.1-1.4 4.7-2.8 6.4C7.6 10.8 6.5 12.6 6.5 15a5.5 5.5 0 0 0 11 0c0-2.2-1-4-2.2-5.3-.2 1.4-.9 2.4-2 2.9.6-3.3-.2-7-1.3-10.1z" />
                      <path className="flame-in" d="M12 21a3 3 0 0 1-3-3c0-1.6 1.2-2.6 2-3.6.2 1 .8 1.6 1.6 1.9-.1-.8.2-1.7.8-2.3.9 1 1.6 2.3 1.6 4A3 3 0 0 1 12 21z" />
                    </svg>
                    <span>{streak}</span>
                  </button>
                )}
                {!sub && (
                  <button className="icon-btn" id="btn-settings" type="button" aria-label="הגדרות" onClick={openSettings}>
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                      <circle cx="16" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.8" fill="none" />
                      <circle cx="10" cy="17" r="2.2" stroke="currentColor" strokeWidth="1.8" fill="none" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {!sub && <p className="cycle" id="cycle-label">{L.cycleLabel(cycle)} · נשארו {daysWord(L.dayDiff(t, cycle.end))}</p>}
          </header>
        )}

        <main id="view" tabIndex={-1} ref={view} key={pageKey} className="view-enter">{page}</main>

        {story && !sub && (
          <button type="button" className="story-fab" id="story-fab" onClick={() => { tick(10); ov.openStory(L.cycleFor(story.start, state.settings.cycleDay)); }}>
            <svg className="fab-coin" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" /><circle cx="16" cy="16" r="8.5" className="fab-coin-in" /><path d="M13 12v8M13 12h3.5a2.5 2.5 0 0 1 0 5H13M19 13v7" className="fab-coin-mark" /></svg>
            <span>הסיכום של {L.cycleLabel(story)}</span>
          </button>
        )}

        {!pre && (
          <nav className="tabs" id="tabs" aria-label="ניווט ראשי">
            {TABS.slice(0, 2).map(([k, l, ic]) => <TabButton key={k} tab={k} label={l} icon={ic} current={!sub && ui.tab === k} go={go} />)}
            <div className="tab-add-slot">
              <button type="button" className="tab-add" id="btn-add" aria-label="רישום הוצאה או הכנסה" onClick={() => ov.openAdd()}><span aria-hidden="true">+</span></button>
            </div>
            {TABS.slice(2).map(([k, l, ic]) => <TabButton key={k} tab={k} label={l} icon={ic} current={!sub && ui.tab === k} go={go} />)}
          </nav>
        )}
      </div>

      <AddSheet />
      <FormSheet />
      <Story />
      <Celebrate />
      <Welcome />
      <StreakFx />
      <StreakSheet />
      <Tour />
      <Toast />
    </>
  );
}
