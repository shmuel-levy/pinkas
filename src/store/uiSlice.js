// Navigation and screen state (not saved). Transient things like open sheets and toasts live in UiContext.
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  tab: 'home', // home | ledger | save | invest
  sub: null, // settings | report | insights | quiz | null
  reportStart: null,
  quiz: null, // { id, step, answers }
  showInstall: false,
  fromShare: false,
  welcomePending: false,
  ledger: { offset: 0, view: 'list', day: null, query: '', cat: '' },
  invQ: { active: false, step: 0, draft: {} }, // the investing questionnaire, kept until finished
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    goTab: (s, { payload: tab }) => {
      s.tab = tab;
      s.sub = null;
      s.reportStart = null;
      if (s.quiz?.id !== 'start') s.quiz = null;
    },
    openSub: (s, { payload: { sub, reportStart = null } }) => {
      s.sub = sub;
      s.reportStart = reportStart;
    },
    closeSub: (s) => {
      s.sub = null;
      s.reportStart = null;
      if (s.quiz?.id !== 'start') s.quiz = null;
    },
    startQuiz: (s, { payload: { id, answers = {} } }) => {
      s.quiz = { id, step: 0, answers };
      s.sub = 'quiz';
    },
    quizAnswer: (s, { payload }) => { Object.assign(s.quiz.answers, payload); },
    quizStep: (s, { payload: delta }) => { s.quiz.step = Math.max(0, s.quiz.step + delta); },
    endQuiz: (s) => {
      s.quiz = null;
      s.sub = null;
    },
    setInstall: (s, { payload: { show, fromShare = false } }) => {
      s.showInstall = show;
      s.fromShare = fromShare;
    },
    setWelcomePending: (s, { payload }) => { s.welcomePending = payload; },
    setLedger: (s, { payload }) => { Object.assign(s.ledger, payload); },
    setInvQ: (s, { payload }) => { s.invQ = { ...s.invQ, ...payload }; },
    ledgerCategory: (s, { payload: cat }) => {
      s.tab = 'ledger';
      s.sub = null;
      s.ledger = { ...s.ledger, cat, offset: 0, query: '', day: null };
    },
  },
});

export const U = uiSlice.actions;
export default uiSlice.reducer;
