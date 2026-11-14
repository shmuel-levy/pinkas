// Every user flow that opens a form or changes data, in one hook. Components call these; reducers do the work.
import { useStore } from 'react-redux';
import * as L from '../lib/logic.js';
import * as S from '../lib/storage.js';
import { D, addCategoryWithColor } from '../store/dataSlice.js';
import { U } from '../store/uiSlice.js';
import { useOverlay } from '../components/UiProvider.jsx';
import { coinDrop, reduced, tick } from '../lib/fx.js';
import { addCalendarReminder, shareApp, shareOrDownload } from '../lib/platform.js';
import { CHANGELOG, VERSION } from '../lib/content.js';

const pad2 = (n) => String(n).padStart(2, '0');
export const fullDate = (iso) => {
  const d = L.fromISO(iso);
  return `${d.getDate()} ב${L.MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

export function useActions() {
  const store = useStore();
  const ov = useOverlay();
  const { toast, openForm } = ov;
  const dispatch = store.dispatch;
  const data = () => store.getState().data;
  const today = () => L.todayISO();
  const money = (a, o) => L.formatMoney(a, data().settings.currency, o);
  const catName = (id) => data().categories.find((c) => c.id === id)?.name || '';
  const activeCats = () => data().categories.filter((c) => !c.archived);
  const catOptions = () => activeCats().map((c) => [c.id, c.name]);

  /* ---------- goals & piggy ---------- */
  function depositToGoal(goalId, amount, slot) {
    const goal = data().goals.find((g) => g.id === goalId);
    if (!goal || !amount) return false;
    ov.setPiggyFrom(goal.saved / goal.target);
    const reaches = goal.saved + amount >= goal.target && !goal.celebratedAt;
    coinDrop(slot || document.querySelector('#view .piggy-slot'));
    tick(15);
    setTimeout(() => {
      dispatch(D.depositGoal({ id: goalId, amount }));
      const g = data().goals.find((x) => x.id === goalId);
      if (reaches) ov.openCelebrate(g);
      else toast(`${money(amount)} נכנסו לקופה. חסרים ${money(g.target - g.saved)}`);
    }, reduced() ? 0 : 420);
    return true;
  }

  function openGoal(goal) {
    openForm({
      title: goal ? 'עריכת מטרה' : 'מטרה חדשה',
      submit: goal ? 'שמירה' : 'ליצור מטרה',
      fields: [
        { name: 'name', label: 'שם המטרה', value: goal?.name, placeholder: 'טיסה ליוון', required: true },
        { name: 'target', label: 'כמה צריך?', type: 'money', value: goal?.target, required: true },
        { name: 'saved', label: 'כמה כבר יש?', type: 'money', value: goal?.saved },
      ],
      extra: goal ? [{
        label: 'מחיקת המטרה', danger: true,
        run: () => {
          const index = data().goals.findIndex((g) => g.id === goal.id);
          dispatch(D.removeGoal(goal.id));
          toast('המטרה נמחקה', { action: 'ביטול', onAction: () => dispatch(D.restoreGoal({ goal, index })) });
        },
      }] : [],
      onSubmit: (v) => {
        if (goal) dispatch(D.updateGoal({ id: goal.id, changes: { name: v.name, target: v.target, saved: v.saved } }));
        else dispatch(D.addGoal({ name: v.name, target: v.target, saved: v.saved || 0 }));
      },
    });
  }

  function openDeposit(goal) {
    openForm({
      title: `הפקדה ל${goal.name}`,
      submit: 'להפקיד',
      fields: [{ name: 'amount', label: 'סכום', type: 'money', required: true, hint: `חסרים ${money(Math.max(0, goal.target - goal.saved))}` }],
      onSubmit: (v) => { depositToGoal(goal.id, v.amount); },
    });
  }

  function openResist(catId) {
    const goals = data().goals.filter((g) => g.saved < g.target);
    openForm({
      title: 'ויתרתי על…',
      submit: 'לרשום ויתור',
      fields: [
        { name: 'name', label: 'על מה ויתרת?', placeholder: 'משלוח סושי', required: true },
        { name: 'amount', label: 'כמה זה היה עולה?', type: 'money', required: true },
        ...(goals.length ? [{ name: 'goal', label: 'להעביר למטרה', type: 'select', value: goals[0].id, options: [['', 'לא, רק לרשום'], ...goals.map((g) => [g.id, g.name])] }] : []),
      ],
      onSubmit: (v) => {
        if (v.goal) {
          dispatch(D.addResisted({ name: v.name, amount: v.amount, date: today(), goalId: null, catId: catId || null }));
          depositToGoal(v.goal, v.amount);
        } else {
          dispatch(D.addResisted({ name: v.name, amount: v.amount, date: today(), goalId: null, catId: catId || null }));
          toast(`${money(v.amount)} נשארו אצלך`);
        }
      },
    });
  }

  function openWish() {
    const s = data().settings;
    openForm({
      title: 'לרשימת ההמתנה',
      submit: `להמתין ${s.waitHours === 168 ? 'שבוע' : `${s.waitHours} שעות`}`,
      fields: [
        { name: 'name', label: 'מה רוצים לקנות?', placeholder: 'אוזניות חדשות', required: true },
        { name: 'amount', label: 'מחיר', type: 'money', required: true },
        { name: 'cat', label: 'קטגוריה (אם תקנו)', type: 'select', value: activeCats().find((c) => c.name === 'קניות')?.id || activeCats()[0]?.id, options: catOptions() },
      ],
      onSubmit: (v) => {
        dispatch(D.addWish({ name: v.name, amount: v.amount, catId: v.cat, waitHours: s.waitHours }));
        toast('נכנס לרשימה. נחזור לזה אחר כך.');
      },
    });
  }

  /* ---------- recurring, spreads, categories ---------- */
  function openRecurring(item) {
    const t = today();
    openForm({
      title: item ? 'עריכת הוצאה קבועה' : 'הוצאה קבועה חדשה',
      submit: item ? 'שמירה' : 'להוסיף',
      fields: [
        { name: 'name', label: 'שם', value: item?.name, placeholder: 'נטפליקס', required: true },
        { name: 'amount', label: 'סכום חודשי', type: 'money', value: item?.amount, required: true },
        { name: 'cat', label: 'קטגוריה', type: 'select', value: item?.catId || activeCats().find((c) => c.name === 'מנויים')?.id || activeCats()[0]?.id, options: catOptions() },
        { name: 'day', label: 'יום החיוב', type: 'select', value: String(item?.day || Number(t.slice(8, 10))), options: Array.from({ length: 31 }, (_, i) => [String(i + 1), `${i + 1} בחודש`]), hint: 'בחודשים קצרים יירשם ביום האחרון' },
        ...(item ? [{ name: 'active', label: 'פעילה', type: 'check', value: item.active }] : [{ name: 'thisMonth', label: 'כבר חויב החודש — לרשום גם עכשיו', type: 'check', value: true }]),
      ],
      extra: item ? [{ label: 'מחיקה', danger: true, run: () => { dispatch(D.removeRecurring(item.id)); toast('ההוצאה הקבועה נמחקה. רישומים קודמים נשארו ביומן.'); } }] : [],
      onSubmit: (v) => {
        const day = Number(v.day);
        if (item) dispatch(D.updateRecurring({ id: item.id, changes: { name: v.name, amount: v.amount, catId: v.cat, day, active: v.active } }));
        else {
          const thisMonth = L.monthKey(t);
          const due = L.clampDay(thisMonth, day) <= t;
          dispatch(D.addRecurring({ name: v.name, amount: v.amount, catId: v.cat, day, startMonth: due && !v.thisMonth ? L.nextMonthKey(thisMonth) : thisMonth }));
        }
        const before = data().expenses.length;
        dispatch(D.applyRecurring(t));
        const added = data().expenses.length - before;
        toast(added ? `נוסף ונרשם ${added === 1 ? 'החיוב של החודש' : `${added} חיובים`}` : 'נשמר');
      },
    });
  }

  function openSpread(item, prefill = {}) {
    const t = today();
    const src = item || prefill;
    const insId = activeCats().find((c) => c.name === 'ביטוחים')?.id || null;
    const NEW = '__new_ins';
    const food = activeCats().find((c) => c.name === 'אוכל בחוץ')?.id;
    const defCat = item?.catId || (prefill.catId && prefill.catId !== food ? prefill.catId : null) || insId || NEW;
    const info = item ? L.spreadInfo(item, t) : null;
    openForm({
      title: item ? item.name : 'ביטוח או הוצאה שנתית',
      intro: item
        ? `${money(info.monthly)} בחודש · ${Math.min(info.passed, item.months)} מתוך ${item.months} חודשים עברו · ${info.active ? `מסתיים ב־${fullDate(info.end)}` : 'הסתיים'}.`
        : 'משלמים פעם אחת על משהו שמכסה תקופה ארוכה? שקל בצד מחלק את הסכום שווה בשווה בין החודשים.',
      submit: item ? 'שמירה' : 'לפרוס',
      fields: [
        { name: 'name', label: 'מה זה?', value: src.name || '', placeholder: 'ביטוח רכב', required: true, max: 40 },
        { name: 'total', label: 'הסכום הכולל', type: 'money', value: src.total, required: true, hint: 'כל התקופה ביחד, למשל הפרמיה השנתית' },
        { name: 'months', label: 'לפרוס על', type: 'select', value: String(src.months || 12), options: [['12', 'שנה (12 חודשים)'], ['6', 'חצי שנה (6)'], ['3', 'רבעון (3)'], ['24', 'שנתיים (24)']] },
        { name: 'start', label: 'מתי מתחיל? (תאריך התשלום או תחילת הפוליסה)', type: 'date', value: src.start || t },
        { name: 'cat', label: 'קטגוריה', type: 'select', value: defCat, options: [...catOptions(), ...(insId ? [] : [[NEW, 'ביטוחים (קטגוריה חדשה)']])] },
      ],
      extra: item ? [
        { label: 'חידוש לתקופה נוספת', run: () => { setTimeout(() => openSpread(null, { name: item.name, total: item.total, months: item.months, catId: item.catId, start: info.end }), 60); } },
        {
          label: 'מחיקה', danger: true,
          run: () => {
            dispatch(D.removeSpread(item.id));
            toast(`${item.name} נמחק`, { action: 'ביטול', onAction: () => dispatch(D.upsertSpread(item)) });
          },
        },
      ] : [],
      onSubmit: (v) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v.start)) return 'צריך תאריך התחלה.';
        let catId = v.cat;
        if (catId === NEW) {
          catId = L.uid();
          dispatch(addCategoryWithColor({ id: catId, name: 'ביטוחים', budget: 0 }));
        }
        const months = Number(v.months);
        dispatch(D.upsertSpread({ ...(item || { id: L.uid(), createdAt: Date.now() }), name: v.name, total: v.total, months, start: v.start, catId }));
        toast(`${v.name}: ${money(Math.round(v.total / months))} בחודש, למשך ${months} חודשים`);
      },
    });
  }

  function openCategory() {
    openForm({
      title: 'קטגוריה חדשה',
      submit: 'להוסיף',
      fields: [
        { name: 'name', label: 'שם', placeholder: 'ילדים', required: true, max: 30 },
        { name: 'budget', label: 'תקציב חודשי', type: 'money', hint: 'לא חובה' },
      ],
      onSubmit: (v) => {
        if (data().categories.some((c) => !c.archived && c.name === v.name)) return 'כבר יש קטגוריה בשם הזה.';
        dispatch(addCategoryWithColor({ name: v.name, budget: v.budget }));
      },
    });
  }

  /* ---------- check-in & balances ---------- */
  function openCheckIn(period = L.checkInStatus(data(), today()).period, onClose) {
    const st = data();
    const day = pad2(st.settings.checkInDay);
    const existing = st.snapshots.find((x) => x.period === period);
    const prevSnap = st.snapshots.filter((x) => x.period < period).sort((a, b) => (a.period < b.period ? -1 : 1)).pop();
    const live = L.liveBalances(st, today());
    const prevAssets = prevSnap ? L.snapshotAssets(prevSnap) : live ? { checking: Math.max(0, live.checking), cash: Math.max(0, live.cash) } : {};
    const curAssets = existing ? L.snapshotAssets(existing) : null;
    const logged = L.sumBy(L.incomesInCycle(st, L.cycleFor(`${period}-${day}`, st.settings.cycleDay)));
    const srcUsd = (existing ? existing.usd : prevSnap?.usd) || {};
    const bankLabel = (key, bank) => {
      const b = L.bankName(bank);
      if (key === 'checking') return b ? `עו״ש ב${b}` : 'עו״ש';
      if (key === 'bankInvest') return b ? `השקעות דרך ${b}` : 'השקעות דרך הבנק';
      return L.ASSET_TYPES.find((a) => a.key === key).label;
    };
    const assetField = (a) => ({
      name: `a_${a.key}`,
      label: a.key === 'checking' || a.key === 'bankInvest' ? (v) => bankLabel(a.key, v.bank) : a.label,
      type: 'money',
      value: curAssets ? curAssets[a.key] : prevAssets[a.key],
      hint: !curAssets && prevAssets[a.key] ? 'מהחודש הקודם, לעדכן אם השתנה' : a.hint,
      fx: a.fx,
      cur: a.fx && srcUsd[a.key] ? 'USD' : 'ILS',
      usdValue: srcUsd[a.key] || 0,
    });
    const group = (g) => [
      { type: 'heading', label: L.ASSET_GROUPS.find((x) => x.key === g).label },
      ...(g === 'liquid' ? [{ name: 'bank', label: 'באיזה בנק החשבון שלך?', type: 'select', value: st.settings.bank, options: [['', 'לא לבחור'], ...L.BANKS.map((b) => [b.id, b.name])] }] : []),
      ...(g === 'invest' ? [{ type: 'note', label: `יש השקעות בדולרים? לוחצים $ ליד השדה, והסכום מומר לשקלים לפי שער הדולר היומי${st.settings.usdRate ? `: ${st.settings.usdRate.rate.toFixed(3)} ₪ לדולר` : ` (כרגע משוער: ${L.DEFAULT_USD_ILS} ₪)`}.` }] : []),
      ...L.ASSET_TYPES.filter((a) => a.group === g).map(assetField),
    ];
    openForm({
      title: `צ׳ק־אין · ${L.monthLabelFromKey(period)}`,
      intro: 'פעם בחודש: כמה נכנס, וכמה יש לך בכל מקום. סכומים מהחודש הקודם כבר ממולאים — מעדכנים רק מה שהשתנה.',
      submit: existing ? 'שמירה' : 'לשמור את החודש',
      onClose,
      fields: [
        { name: 'income', label: 'כמה כסף נכנס החודש?', type: 'money', required: true, value: existing?.income ?? (logged || prevSnap?.income || st.settings.income || 0), hint: logged ? `רשמת ${money(logged, { round: true })} כהכנסות במחזור הזה` : 'משכורת וכל הכנסה אחרת, נטו' },
        ...group('liquid'), ...group('invest'), ...group('longterm'),
      ],
      extra: [
        ...(existing ? [{ label: 'מחיקת הצ׳ק־אין', danger: true, run: () => { dispatch(D.removeSnapshot(period)); toast('הצ׳ק־אין נמחק'); } }] : []),
        { label: 'תזכורת קבועה ביומן', run: () => { addCalendarReminder(data().settings); return false; } },
      ],
      onSubmit: (v, rate) => {
        const assets = {};
        const usd = {};
        for (const a of L.ASSET_TYPES) {
          assets[a.key] = v[`a_${a.key}`] || 0;
          if (v[`a_${a.key}__usd`]) usd[a.key] = v[`a_${a.key}__usd`];
        }
        const snap = { id: existing?.id || L.uid(), period, date: existing?.date || `${period}-${day}`, income: v.income, assets, savedAt: Date.now() };
        if (Object.keys(usd).length) Object.assign(snap, { usd, usdRate: rate });
        dispatch(D.upsertSnapshot(snap));
        dispatch(D.setBalanceAnchor({ checking: assets.checking, cash: assets.cash }));
        const latest = [...data().snapshots].sort((a, b) => (a.period < b.period ? 1 : -1))[0];
        dispatch(D.mergeSettings({ bank: v.bank || '', checkInPrompted: period, ...(latest.period === period ? { income: v.income } : {}) }));
        const nw = L.netWorth(snap);
        const change = prevSnap ? nw - L.netWorth(prevSnap) : null;
        toast(change === null ? `נשמר. השווי שלך: ${money(nw, { round: true })}` : `השווי שלך: ${money(nw, { round: true })} (${money(change, { round: true, signed: true })} מהחודש הקודם)`);
      },
    });
  }

  function openBalances() {
    const b = L.liveBalances(data(), today());
    openForm({
      title: 'כמה יש לך עכשיו?',
      intro: 'מה שרושמים כאן הופך לנקודת ההתחלה החדשה. מכאן כל הוצאה והכנסה יעדכנו את היתרה לבד.',
      submit: 'שמירה',
      fields: [
        { name: 'checking', label: 'עו״ש', type: 'money', value: b ? Math.max(0, b.checking) : 0, hint: b && b.checking < 0 ? `לפי הרישומים: ${money(b.checking, { round: true })}` : '' },
        { name: 'cash', label: 'מזומן', type: 'money', value: b ? Math.max(0, b.cash) : 0 },
        { name: 'bank', label: 'הבנק', type: 'select', value: data().settings.bank, options: [['', 'לא נבחר'], ...L.BANKS.map((x) => [x.id, x.name])] },
      ],
      onSubmit: (v) => {
        dispatch(D.setBalanceAnchor({ checking: v.checking, cash: v.cash }));
        dispatch(D.setSetting({ key: 'bank', value: v.bank || '' }));
        toast('היתרה עודכנה');
      },
    });
  }

  /* ---------- what's new, backup, restore, share ---------- */
  function showWhatsNew(force = false, onClose) {
    const st = data();
    if (!force && (!st.onboarded || st.settings.lastSeenVersion === VERSION)) return false;
    const entry = CHANGELOG.find((c) => c.v === VERSION) || CHANGELOG[0];
    dispatch(D.setSetting({ key: 'lastSeenVersion', value: VERSION }));
    openForm({
      title: `מה חדש בשקל בצד ${entry.v}`,
      body: <ul className="whats-new">{entry.items.map((i) => <li key={i}>{i}</li>)}</ul>,
      fields: [],
      submit: 'מעולה',
      onSubmit: () => {},
      onClose,
    });
    return true;
  }

  async function backup() {
    const ok = await shareOrDownload(`pinkas-${today()}.json`, S.exportJSON(data()), 'application/json');
    if (ok) {
      dispatch(D.setSetting({ key: 'lastBackupAt', value: Date.now() }));
      toast('הגיבוי נשמר');
    }
  }

  function restore(file) {
    file.text().then((txt) => {
      try {
        const next = S.importJSON(txt);
        if (data().expenses.length && !confirm(`לשחזר מהגיבוי? ${next.expenses.length} הוצאות יחליפו את ${data().expenses.length} שבטלפון עכשיו.`)) return;
        next.onboarded = true;
        dispatch(D.replaceAll(L.applyRecurring(next, today()).state));
        dispatch(U.goTab('home'));
        toast(`שוחזרו ${next.expenses.length} הוצאות`);
      } catch (err) {
        toast(err.message || 'לא הצלחנו לקרוא את הקובץ.', { alert: true });
      }
    });
  }

  function wipe() {
    if (!confirm('למחוק את כל ההוצאות, המטרות וההגדרות מהטלפון? אי אפשר לבטל את זה. כדאי לשמור גיבוי קודם.')) return;
    dispatch(D.replaceAll(S.defaultState()));
    dispatch(U.goTab('home'));
  }

  async function share() {
    const r = await shareApp();
    if (r === 'copied') toast('ההודעה והקישור הועתקו. אפשר להדביק בוואטסאפ.');
    else if (r !== 'shared' && r !== 'cancel') toast(`הקישור: ${r}`, { ms: 9000 });
  }

  return {
    depositToGoal, openGoal, openDeposit, openResist, openWish,
    openRecurring, openSpread, openCategory, openCheckIn, openBalances,
    showWhatsNew, backup, restore, wipe, share, catName,
    reminder: () => addCalendarReminder(data().settings),
  };
}
