// How to put פנקס on the home screen — per platform (iPhone Safari, other iPhone browsers, Android, desktop).
import { useDispatch } from 'react-redux';
import { useUi } from '../hooks/useApp.js';
import { D } from '../store/dataSlice.js';
import { U } from '../store/uiSlice.js';
import { useOverlay } from '../components/UiProvider.jsx';
import { canPromptInstall, platform, promptInstall } from '../lib/platform.js';

const IconShare = () => (
  <svg className="ig-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 11v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IconPlus = () => (
  <svg className="ig-icon" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IconDots = () => (
  <svg className="ig-icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="5" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="19" r="1.8" fill="currentColor" />
  </svg>
);
const Step = ({ n, children }) => <li><span className="ig-n">{n}</span><span>{children}</span></li>;

export function InstallPage() {
  const { fromShare } = useUi();
  const dispatch = useDispatch();
  const { toast } = useOverlay();
  const p = platform();
  const url = location.origin + location.pathname;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('הקישור הועתק');
    } catch {
      toast('לא הצלחנו להעתיק. אפשר לסמן את הכתובת ולהעתיק ידנית.');
    }
  };
  const done = () => {
    dispatch(D.setSetting({ key: 'installGuideSeen', value: true }));
    dispatch(U.setInstall({ show: false }));
    history.replaceState(null, '', location.pathname);
    window.scrollTo(0, 0);
  };

  let lead;
  let steps;
  if (p.ios && (p.otherIOSBrowser || p.inApp)) {
    lead = 'כדי להוסיף את פנקס למסך הבית צריך לפתוח את הקישור בספארי.';
    steps = (
      <ol className="ig-steps">
        <Step n={1}>מעתיקים את הקישור<button type="button" className="btn btn-line btn-small ig-copy" onClick={copy}>העתקת הקישור</button></Step>
        <Step n={2}>פותחים את <strong>ספארי</strong> ומדביקים בשורת הכתובת</Step>
        <Step n={3}>משם ממשיכים לפי ההוראות שיופיעו</Step>
      </ol>
    );
  } else if (p.ios) {
    lead = 'ככה פנקס יופיע במסך הבית ויפתח כמו אפליקציה רגילה:';
    steps = (
      <ol className="ig-steps">
        <Step n={1}>לוחצים על כפתור השיתוף <IconShare /> בתחתית ספארי</Step>
        <Step n={2}>גוללים ובוחרים <strong>״הוספה למסך הבית״</strong> <IconPlus /></Step>
        <Step n={3}>לוחצים <strong>״הוסף״</strong> למעלה. זהו.</Step>
      </ol>
    );
  } else if (p.android) {
    const one = canPromptInstall();
    lead = one ? 'לחיצה אחת ופנקס מותקן במסך הבית:' : 'ככה פנקס יופיע במסך הבית ויפתח כמו אפליקציה רגילה:';
    steps = one ? (
      <button type="button" className="btn btn-primary ig-install" onClick={async () => { if (await promptInstall()) toast('פנקס הותקן. אפשר לפתוח אותו ממסך הבית.'); }}>התקנת פנקס</button>
    ) : (
      <ol className="ig-steps">
        <Step n={1}>לוחצים על התפריט <IconDots /> {p.samsung ? 'בתחתית הדפדפן' : 'בפינה העליונה של כרום'}</Step>
        <Step n={2}>בוחרים <strong>״התקנת אפליקציה״</strong> או <strong>״הוספה למסך הבית״</strong></Step>
        <Step n={3}>מאשרים. פנקס יופיע עם שאר האפליקציות.</Step>
      </ol>
    );
  } else {
    lead = 'פנקס בנויה לטלפון. פותחים את הקישור באייפון או באנדרואיד ומוסיפים למסך הבית:';
    steps = <div className="ig-link"><span className="num">{url}</span><button type="button" className="btn btn-line btn-small" onClick={copy}>העתקה</button></div>;
  }

  return (
    <section className="install" aria-labelledby="ig-h">
      <div className="ig-hero vault">
        <img className="ig-icon-app" src="icons/icon-192.png" alt="" width="72" height="72" />
        <p className="vault-label">{fromShare ? 'חבר שלח לך את' : 'להתקנה'}</p>
        <h1 className="ig-title" id="ig-h">פנקס</h1>
        <p className="hero-sub">ניהול הוצאות, חיסכון והון. חינם, בעברית, והנתונים נשארים רק אצלך.</p>
      </div>
      <p className="ig-lead">{lead}</p>
      {steps}
      <button type="button" className="link ig-skip" onClick={done}>להמשיך בדפדפן בלי להתקין</button>
    </section>
  );
}
