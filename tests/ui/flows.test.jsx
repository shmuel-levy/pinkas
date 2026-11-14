// End-to-end user flows on the real components and Redux store (jsdom).
import { describe, expect, it } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as L from '../../src/lib/logic.js';
import { STORAGE_KEY, defaultState } from '../../src/lib/storage.js';
import { food, renderApp, returningUser } from './helpers.jsx';

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY));
const press = async (user, digits) => {
  const pad = screen.getByRole('group', { name: 'מקלדת סכום' });
  for (const d of digits) await user.click(within(pad).getByRole('button', { name: d }));
};

// the three "who are you" questions at the start
const answerProfile = async (user, { name = 'דנה', level = /מתחיל/, focus = /לחסוך למשהו/ } = {}) => {
  const field = await screen.findByLabelText('השם שלך');
  if (name) await user.type(field, name);
  await user.click(screen.getByRole('button', { name: name ? 'המשך' : 'המשך בלי שם' }));
  await user.click(screen.getByRole('radio', { name: level }));
  await user.click(screen.getByRole('radio', { name: focus }));
};

describe('first run', () => {
  it('gets to know you, asks for the checking balance, welcomes you by name, then starts the home guide', async () => {
    const user = userEvent.setup();
    const { store } = renderApp(defaultState());
    expect(await screen.findByRole('heading', { name: 'נעים להכיר. איך לקרוא לך?' })).toBeInTheDocument();
    await answerProfile(user);
    expect(await screen.findByRole('heading', { name: 'כמה כסף יש לך עכשיו בעו״ש?' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('בעו״ש'), '4500');
    await user.type(screen.getByLabelText('ומזומן בארנק (לא חובה)'), '300');
    await user.selectOptions(screen.getByLabelText('באיזה בנק? (לא חובה)'), 'otsar');
    await user.click(screen.getByRole('button', { name: 'מתחילים' }));

    const s = store.getState().data;
    expect(s.onboarded).toBe(true);
    expect(s.balanceAnchor).toMatchObject({ checking: 450000, cash: 30000 });
    expect(s.settings.bank).toBe('otsar');
    expect(s.settings).toMatchObject({ name: 'דנה', level: 'beginner', focus: 'save' });
    expect(saved().onboarded).toBe(true); // persisted

    const welcome = await screen.findByRole('dialog', { name: 'שמחים שהגעת, דנה' }, { timeout: 3000 });
    await user.click(within(welcome).getByRole('button', { name: 'המשך להדרכה' }));
    const tour = await screen.findByRole('dialog', { name: 'היתרה שלך' }, { timeout: 3000 });
    // the first three steps can't be skipped
    expect(within(tour).queryByRole('button', { name: 'דילוג על ההמשך' })).toBeNull();
    expect(within(tour).getByText(/1 מתוך \d+ · חשוב/)).toBeInTheDocument();
  });

  it('rejects a balance that is not a number', async () => {
    const user = userEvent.setup();
    const { store } = renderApp(defaultState());
    await answerProfile(user, { name: '', level: /מנוסה/, focus: /להפסיק לחרוג/ });
    await user.type(await screen.findByLabelText('בעו״ש'), 'abc');
    await user.click(screen.getByRole('button', { name: 'מתחילים' }));
    expect(screen.getByRole('alert')).toHaveTextContent('צריך מספר');
    expect(store.getState().data.onboarded).toBe(false);
  });
});

describe('recording an expense', () => {
  it('keypad → place → pay step → cash balance goes down, and undo puts it back', async () => {
    const user = userEvent.setup();
    const { store } = renderApp();
    await user.click(screen.getByRole('button', { name: 'רישום הוצאה או הכנסה' }));
    await press(user, '48');
    await user.type(screen.getByLabelText('איפה, או על מה'), 'ארומה');
    expect(screen.getByText(/אחרי זה נשארו/)).toHaveTextContent('₪552');
    await user.click(screen.getByRole('button', { name: 'לרשום ₪48' }));

    const pay = screen.getByRole('group', { name: 'מאיפה ירד הכסף?' });
    await user.click(within(pay).getByRole('button', { name: /^מזומן/ }));

    const s = store.getState().data;
    expect(s.expenses).toHaveLength(1);
    expect(s.expenses[0]).toMatchObject({ amount: 4800, note: 'ארומה', pay: 'cash' });
    expect(L.liveBalances(s, L.todayISO()).cash).toBe(30000 - 4800);
    expect(screen.getByRole('status')).toHaveTextContent('ההוצאה הראשונה נרשמה'); // a warm word the first time

    await user.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(store.getState().data.expenses).toHaveLength(0);
  });

  it('stops before going over budget, and "I skipped it" saves the money instead', async () => {
    const user = userEvent.setup();
    const { store } = renderApp();
    await user.click(screen.getByRole('button', { name: 'רישום הוצאה או הכנסה' }));
    await press(user, '700');
    await user.click(screen.getByRole('button', { name: 'לרשום ₪700' }));
    const alert = screen.getByRole('alertdialog');
    expect(alert).toHaveTextContent('זה יוציא אותך מתקציב אוכל בחוץ');
    await user.click(within(alert).getByRole('button', { name: /ויתרתי/ }));
    const s = store.getState().data;
    expect(s.expenses).toHaveLength(0);
    expect(s.resisted.map((r) => r.amount)).toEqual([70000]);
  });

  it('requires an amount', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'רישום הוצאה או הכנסה' }));
    await user.click(screen.getByRole('button', { name: 'לרשום' }));
    expect(screen.getByRole('alert')).toHaveTextContent('חסר סכום');
  });

  it('records an income into checking', async () => {
    const user = userEvent.setup();
    const { store } = renderApp();
    await user.click(screen.getByRole('button', { name: 'רישום הוצאה או הכנסה' }));
    await user.click(screen.getByRole('radio', { name: 'הכנסה' }));
    await press(user, '1000');
    await user.click(screen.getByRole('button', { name: 'לרשום הכנסה ₪1,000' }));
    await user.click(within(screen.getByRole('group', { name: 'לאן נכנס הכסף?' })).getByRole('button', { name: /לעו״ש/ }));
    const s = store.getState().data;
    expect(s.incomes).toHaveLength(1);
    expect(L.liveBalances(s, L.todayISO()).checking).toBe(450000 + 100000);
  });
});

describe('budget questionnaire', () => {
  it('sets income, monthly budget, eating-out budget and the cycle day', async () => {
    const user = userEvent.setup();
    const { store } = renderApp();
    await user.click(screen.getByRole('button', { name: 'להגדיר תקציב' }));
    await user.type(screen.getByLabelText('הכנסה חודשית'), '12000');
    await user.click(screen.getByRole('button', { name: 'המשך' }));
    // suggestion = 80% of income
    await user.click(screen.getByRole('button', { name: /הצעה/ }));
    await user.click(screen.getByRole('button', { name: 'המשך' }));
    await user.clear(screen.getByLabelText('אוכל בחוץ בחודש'));
    await user.type(screen.getByLabelText('אוכל בחוץ בחודש'), '800');
    await user.click(screen.getByRole('button', { name: 'המשך' }));
    await user.click(screen.getByRole('radio', { name: 'ב־10 לחודש' }));

    const s = store.getState().data;
    expect(s.settings).toMatchObject({ income: 1200000, monthlyBudget: 960000, cycleDay: 10 });
    expect(food(s).budget).toBe(80000);
    expect(await screen.findByText('מותר להוציא היום')).toBeInTheDocument();
  });
});

describe('savings', () => {
  it('a deposit that reaches the goal opens the celebration', async () => {
    const user = userEvent.setup();
    const state = returningUser({ goals: [{ id: 'g1', name: 'טיסה', target: 100000, saved: 90000, celebratedAt: 0, createdAt: 1 }] });
    const { store } = renderApp(state);
    await user.click(screen.getByRole('button', { name: 'חיסכון' }));
    expect(screen.getByRole('img', { name: '90 אחוז מהמטרה טיסה' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'הפקדה' })[0]);
    await user.type(screen.getByLabelText('סכום'), '100');
    await user.click(screen.getByRole('button', { name: 'להפקיד' }));
    expect(await screen.findByRole('dialog', { name: 'הגעת ליעד: טיסה' })).toBeInTheDocument();
    expect(store.getState().data.goals[0].saved).toBe(100000);
  });
});

describe('investments', () => {
  it('status → 4 questions → a plan with a broker comparison', async () => {
    const user = userEvent.setup();
    const { store } = renderApp();
    await user.click(screen.getByRole('button', { name: 'השקעות' }));
    await user.click(screen.getByRole('radio', { name: /רוצה להתחיל להשקיע/ }));
    expect(screen.getByText('שאלה 1 מתוך 4')).toBeInTheDocument();
    await user.click(screen.getAllByRole('radio')[2]); // horizon
    await user.click(screen.getAllByRole('radio')[0]); // goal
    await user.type(screen.getByLabelText('הפקדה חודשית'), '1000');
    await user.click(screen.getByRole('button', { name: 'המשך' }));
    await user.click(screen.getByRole('radio', { name: /^עוד לא יודע/ })); // counts as Tel Aviv
    expect(store.getState().data.invest.profile).toMatchObject({ monthly: 100000, market: 'ta' });
    expect(screen.getByRole('heading', { name: 'התוכנית שלך' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'בדיקת דמי ניהול בפנסיה' })).toBeInTheDocument();
  });
});

describe('saved data from the previous (vanilla JS) version', () => {
  it('opens with all records, balances and settings intact', async () => {
    const t = L.todayISO();
    const legacy = returningUser({
      expenses: [{ id: 'e1', amount: 2500, catId: 'c-food', note: 'קפה', date: t, createdAt: Date.now(), pay: 'credit' }],
      incomes: [{ id: 'i1', amount: 100000, date: t, note: '', source: 'משכורת', createdAt: Date.now() }],
    });
    legacy.categories = legacy.categories.map((c) => (c.name === 'אוכל בחוץ' ? { ...c, id: 'c-food' } : c));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const { store } = renderApp(null);
    expect(store.getState().data.expenses).toHaveLength(1);
    expect(screen.getByRole('button', { name: /קפה, ₪25/ })).toBeInTheDocument();
    // checking: 4,500 + 1,000 income − 25 on credit
    await waitFor(() => expect(screen.getAllByText('₪5,475').length).toBeGreaterThan(0));
  });
});

describe('monthly check-in', () => {
  it('saves assets (one of them in dollars), the bank, and resets the live balances', async () => {
    const user = userEvent.setup();
    const state = returningUser({ settings: { usdRate: { rate: 3.2, date: L.todayISO() } } });
    const { store } = renderApp(state);
    await user.click(screen.getByRole('button', { name: /צ׳ק־אין/ }));
    const form = screen.getByRole('dialog', { name: /צ׳ק־אין/ });
    await user.selectOptions(within(form).getByLabelText('באיזה בנק החשבון שלך?'), 'leumi');
    // the checking field is renamed after the bank
    const checking = within(form).getByLabelText('עו״ש בלאומי');
    await user.clear(checking);
    await user.type(checking, '5000');
    await user.click(within(form).getByRole('group', { name: /מטבע: תיק השקעות/ }).querySelectorAll('button')[1]);
    await user.type(within(form).getByRole('textbox', { name: 'תיק השקעות בבית השקעות' }), '1000');
    expect(within(form).getByText(/≈ ₪3,200/)).toBeInTheDocument();
    await user.clear(within(form).getByLabelText('כמה כסף נכנס החודש?'));
    await user.type(within(form).getByLabelText('כמה כסף נכנס החודש?'), '12000');
    await user.click(within(form).getByRole('button', { name: 'לשמור את החודש' }));

    const s = store.getState().data;
    const snap = s.snapshots.at(-1);
    expect(snap.assets).toMatchObject({ checking: 500000, stocks: 320000 });
    expect(snap.usd).toEqual({ stocks: 100000 });
    expect(s.settings.bank).toBe('leumi');
    expect(s.balanceAnchor.checking).toBe(500000);
    expect(screen.getByRole('status')).toHaveTextContent('השווי שלך');
  });
});

describe('a day, opened from any calendar', () => {
  const t = L.todayISO();
  const withDay = () => {
    const s = returningUser({ settings: { level: 'pro' } });
    const fid = s.categories.find((c) => c.name === 'אוכל בחוץ').id;
    s.expenses = [
      { id: 'e1', amount: 4200, catId: fid, note: 'ארומה', date: t, createdAt: Date.now(), pay: 'credit' },
      { id: 'e2', amount: 1800, catId: fid, note: 'מאפייה', date: t, createdAt: Date.now() + 1, pay: 'cash' },
    ];
    s.resisted = [{ id: 'r1', name: 'משלוח סושי', amount: 9000, date: t, goalId: null, catId: fid, createdAt: 1 }];
    return s;
  };

  it('ledger calendar: shows the day\'s entries, totals and skipped purchases, and adds to that date', async () => {
    const user = userEvent.setup();
    const { store } = renderApp(withDay());
    await user.click(screen.getByRole('button', { name: 'יומן' }));
    await user.click(screen.getByRole('radio', { name: 'לוח חודשי' }));
    const d = Number(t.slice(8));
    await user.click(screen.getByRole('button', { name: new RegExp(`^${d} ב.*פתיחת היום$`) }));
    const sheet = screen.getByRole('dialog', { name: /היום$/ });
    expect(within(sheet).getByText('2 רישומים')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /ארומה, ₪42/ })).toBeInTheDocument();
    expect(within(sheet).getByText('משלוח סושי')).toBeInTheDocument();
    expect(within(sheet).getAllByText('₪60').length).toBeGreaterThan(0);
    // add an expense to this day
    await user.click(within(sheet).getByRole('button', { name: 'להוסיף הוצאה ליום הזה' }));
    expect(screen.getByLabelText('תאריך')).toHaveValue(t);
    // previous day: nothing recorded
    store.getState();
  });

  it('no-spend calendar: a day without spending says so', async () => {
    const user = userEvent.setup();
    const state = withDay();
    const cyc = L.cycleFor(t, 1);
    if (cyc.start === t) return; // first day of the month: no earlier day to open
    renderApp(state);
    await user.click(screen.getByRole('button', { name: 'חיסכון' }));
    const yesterday = L.addDays(t, -1);
    const n = Number(yesterday.slice(8));
    await user.click(within(screen.getByRole('group', { name: /לוח המחזור/ })).getByRole('button', { name: new RegExp(`^${n} ב`) }));
    const sheet = screen.getByRole('dialog', { name: /אתמול$/ });
    expect(within(sheet).getByText('יום בלי הוצאות.')).toBeInTheDocument();
  });
});

describe('getting to know you', () => {
  it('existing users are invited to the profile questions, and beginners then get first steps and tips', async () => {
    const user = userEvent.setup();
    const { store } = renderApp();
    await user.click(screen.getByRole('button', { name: 'בואו נתחיל' }));
    expect(screen.getByRole('heading', { name: 'הפרופיל שלך' })).toBeInTheDocument();
    await answerProfile(user, { name: 'יוסי', level: /מתחיל/, focus: /להפסיק לחרוג/ });
    expect(store.getState().data.settings).toMatchObject({ name: 'יוסי', level: 'beginner', focus: 'spend' });
    expect(screen.getByText(/, יוסי$/)).toBeInTheDocument(); // greeting by name
    expect(screen.getByRole('heading', { name: 'הצעדים הראשונים שלך' })).toBeInTheDocument();
    // a beginner tip, dismissed for good
    await user.click(screen.getByRole('button', { name: 'יומן' }));
    const tip = screen.getByRole('complementary', { name: 'הסבר: מה זה היומן' });
    await user.click(within(tip).getByRole('button', { name: 'הבנתי' }));
    expect(screen.queryByRole('complementary', { name: 'הסבר: מה זה היומן' })).toBeNull();
    expect(store.getState().data.settings.tipsSeen.ledger).toBe(true);
  });

  it('experienced users get no tips and no first-steps list', async () => {
    renderApp(returningUser({ settings: { level: 'pro', name: 'רון' } }));
    expect(screen.queryByRole('heading', { name: 'הצעדים הראשונים שלך' })).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByRole('button', { name: 'בואו נתחיל' })).toBeNull();
  });

  it('the app is called שקל בצד', () => {
    renderApp(returningUser({ settings: { level: 'pro' } }));
    expect(screen.getByRole('heading', { level: 1, name: 'שקל בצד' })).toBeInTheDocument();
  });
});
