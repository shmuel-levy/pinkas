// First-run intro, guided tour, install guide (Android / iPhone) and sharing.
import { piggySVG, settlePiggy } from './piggy.js';
import { reduced } from './fx.js';

/* ---------- platform ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // keep it for our own "install" button
  deferredPrompt = e;
});

export function platform() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const otherIOSBrowser = ios && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  const inApp = /Instagram|FBAN|FBAV|WhatsApp|Line\/|TikTok/i.test(ua);
  const samsung = /SamsungBrowser/i.test(ua);
  return { ios, android, otherIOSBrowser, inApp, samsung, mobile: ios || android };
}
export function isStandalone() {
  return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
}

export const CHANGELOG = [
  {
    v: '1.5.0',
    items: [
      'השקעות בדולרים: לוחצים $ ליד השדה בצ׳ק־אין, והסכום מומר לשקלים לפי שער הדולר היומי.',
      'הבנק שלך: בוחרים בנק, ורואים כמה בעו״ש, כמה מושקע דרך הבנק וכמה דמי המשמרת עולים שם.',
      'לשונית ההשקעות ברורה יותר: דוגמאות (S&P 500, ת״א 35), הסבר לכל שאלה, ומילון מונחים.',
      'אפשר לאפס את כל נתוני ההשקעות בלחיצה.',
      'סיור מודרך קצר בכניסה הראשונה.',
    ],
  },
  {
    v: '1.4.0',
    items: [
      'סיכום חודשי ב־10 לכל חודש: מסע קצר על מה הלך הכסף, מה עבד, ומה היה קורה אם היית משקיע.',
      'קופת חיסכון שמתמלאת לקראת המטרה — ומתפוצצת כשמגיעים.',
      'מפת הכסף שלך: עו״ש, מזומן, פיקדונות, תיק, גמל להשקעה, השתלמות ופנסיה.',
      'לשונית השקעות: השוואת עמלות בין בתי השקעות ובדיקת דמי ניהול בפנסיה.',
      'שיתוף לחבר עם הוראות התקנה לאנדרואיד ולאייפון.',
    ],
  },
];

const ICON_SHARE = '<svg class="ig-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_PLUS = '<svg class="ig-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_DOTS = '<svg class="ig-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="19" r="1.8" fill="currentColor"/></svg>';

export function createOnboarding(api) {
  const { esc } = api;

  /* ---------- intro slides ---------- */
  const SLIDES = [
    {
      art: 'note',
      title: 'פנקס',
      text: 'כל הכסף שלך במקום אחד. בעברית, בשקלים, בלי פרסומות ובלי בלגן.',
    },
    { art: 'keypad', title: 'רושמים בשנייה', text: 'סכום, מקום, קטגוריה. אחרי פעמיים באותו מקום פנקס כבר זוכר לבד, וגם שואל אם זו הוראת קבע.' },
    { art: 'budget', title: 'עוצרים לפני שחורגים', text: 'תקציב לכל קטגוריה, וכמה מותר להוציא היום. רגע לפני חריגה — פנקס שואל אם זה שווה את זה.' },
    { art: 'piggy', title: 'חוסכים למטרה', text: 'קופה שמתמלאת עם כל שקל שחסכת. כשמגיעים ליעד — היא מתפוצצת.' },
    { art: 'story', title: 'ב־10 לכל חודש: הסיכום שלך', text: 'על מה הלך הכסף, מה עבד, מה ללמוד — ומה היה קורה אם היית משקיע במקום.' },
    { art: 'lock', title: 'הנתונים נשארים אצלך', text: 'בלי חשבון ובלי שרת. הכל נשמר רק בטלפון שלך. גיבוי — מתי שבא לך.' },
  ];

  function art(kind) {
    if (kind === 'note') {
      return `<div class="ia ia-note vault"><span class="ia-note-k">פנקס</span><span class="ia-note-v num">₪0</span><span class="ia-seal" aria-hidden="true"></span></div>`;
    }
    if (kind === 'keypad') {
      return `<div class="ia ia-keypad"><div class="ia-amount num">₪48</div><div class="ia-place">ארומה</div>
        <div class="ia-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<span class="${k === 4 || k === 8 ? 'press' : ''}">${k}</span>`).join('')}</div></div>`;
    }
    if (kind === 'budget') {
      return `<div class="ia ia-budget"><div class="ia-b-row"><span>אוכל בחוץ</span><span class="num">₪552 / ₪600</span></div>
        <div class="ia-bar"><span></span><i></i></div><div class="ia-stop">רגע לפני</div></div>`;
    }
    if (kind === 'piggy') return `<div class="ia ia-piggy">${piggySVG(0.7, { from: 0.1, label: '' })}</div>`;
    if (kind === 'story') {
      return `<div class="ia ia-story"><div class="ia-card c1"></div><div class="ia-card c2"></div><div class="ia-card c3 vault"><span class="num">₪11,314</span><span>אוקטובר</span></div></div>`;
    }
    return `<div class="ia ia-lock"><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="28" width="36" height="26" rx="6"/><path d="M22 28v-8a10 10 0 0 1 20 0v8" fill="none"/><circle cx="32" cy="41" r="3.5"/></svg></div>`;
  }

  function renderIntro(step) {
    const s = SLIDES[step];
    const last = step === SLIDES.length - 1;
    return `<section class="intro" aria-roledescription="מצגת" aria-label="היכרות עם פנקס">
      <div class="intro-art" aria-hidden="true">${art(s.art)}</div>
      <div class="intro-text">
        <h1 class="intro-title">${esc(s.title)}</h1>
        <p class="intro-p">${esc(s.text)}</p>
      </div>
      <div class="intro-dots" aria-hidden="true">${SLIDES.map((_, i) => `<span class="${i === step ? 'on' : ''}"></span>`).join('')}</div>
      <p class="sr-only" aria-live="polite">שלב ${step + 1} מתוך ${SLIDES.length}</p>
      <div class="intro-actions">
        <button type="button" class="btn btn-primary" data-intro="next">${last ? 'מתחילים' : 'הבא'}</button>
        ${last ? '' : '<button type="button" class="link" data-intro="skip">דילוג</button>'}
      </div>
    </section>`;
  }

  function afterIntroRender() {
    settlePiggy(document.querySelector('.intro .piggy'));
  }

  /* ---------- install guide ---------- */
  function renderInstall({ fromShare }) {
    const p = platform();
    const url = location.origin + location.pathname;
    let steps = '';
    let lead = '';
    if (p.ios && (p.otherIOSBrowser || p.inApp)) {
      lead = 'כדי להוסיף את פנקס למסך הבית צריך לפתוח את הקישור בספארי.';
      steps = `<ol class="ig-steps">
        <li><span class="ig-n">1</span><span>מעתיקים את הקישור<button type="button" class="btn btn-line btn-small ig-copy" data-install="copy">העתקת הקישור</button></span></li>
        <li><span class="ig-n">2</span><span>פותחים את <strong>ספארי</strong> ומדביקים בשורת הכתובת</span></li>
        <li><span class="ig-n">3</span><span>משם ממשיכים לפי ההוראות שיופיעו</span></li>
      </ol>`;
    } else if (p.ios) {
      lead = 'ככה פנקס יופיע במסך הבית ויפתח כמו אפליקציה רגילה:';
      steps = `<ol class="ig-steps">
        <li><span class="ig-n">1</span><span>לוחצים על כפתור השיתוף ${ICON_SHARE} בתחתית ספארי</span></li>
        <li><span class="ig-n">2</span><span>גוללים ובוחרים <strong>״הוספה למסך הבית״</strong> ${ICON_PLUS}</span></li>
        <li><span class="ig-n">3</span><span>לוחצים <strong>״הוסף״</strong> למעלה. זהו.</span></li>
      </ol>`;
    } else if (p.android) {
      lead = deferredPrompt ? 'לחיצה אחת ופנקס מותקן במסך הבית:' : 'ככה פנקס יופיע במסך הבית ויפתח כמו אפליקציה רגילה:';
      steps = deferredPrompt
        ? '<button type="button" class="btn btn-primary ig-install" data-install="prompt">התקנת פנקס</button>'
        : `<ol class="ig-steps">
            <li><span class="ig-n">1</span><span>לוחצים על התפריט ${ICON_DOTS} ${p.samsung ? 'בתחתית הדפדפן' : 'בפינה העליונה של כרום'}</span></li>
            <li><span class="ig-n">2</span><span>בוחרים <strong>״התקנת אפליקציה״</strong> או <strong>״הוספה למסך הבית״</strong></span></li>
            <li><span class="ig-n">3</span><span>מאשרים. פנקס יופיע עם שאר האפליקציות.</span></li>
          </ol>`;
    } else {
      lead = 'פנקס בנויה לטלפון. פותחים את הקישור באייפון או באנדרואיד ומוסיפים למסך הבית:';
      steps = `<div class="ig-link"><span class="num">${esc(url)}</span><button type="button" class="btn btn-line btn-small" data-install="copy">העתקה</button></div>`;
    }
    return `<section class="install" aria-labelledby="ig-h">
      <div class="ig-hero vault">
        <img class="ig-icon-app" src="icons/icon-192.png" alt="" width="72" height="72">
        <p class="vault-label">${fromShare ? 'חבר שלח לך את' : 'להתקנה'}</p>
        <h1 class="ig-title" id="ig-h">פנקס</h1>
        <p class="hero-sub">ניהול הוצאות, חיסכון והון. חינם, בעברית, והנתונים נשארים רק אצלך.</p>
      </div>
      <p class="ig-lead">${esc(lead)}</p>
      ${steps}
      <button type="button" class="link ig-skip" data-install="skip">להמשיך בדפדפן בלי להתקין</button>
    </section>`;
  }

  async function onInstallClick(el) {
    const a = el.dataset.install;
    if (a === 'copy') {
      try {
        await navigator.clipboard.writeText(location.origin + location.pathname);
        api.toast('הקישור הועתק');
      } catch {
        api.toast('לא הצלחנו להעתיק. אפשר לסמן את הכתובת ולהעתיק ידנית.');
      }
    }
    if (a === 'prompt' && deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      deferredPrompt = null;
      if (choice?.outcome === 'accepted') api.toast('פנקס הותקן. אפשר לפתוח אותו ממסך הבית.');
    }
    if (a === 'skip') api.installDone();
  }

  /* ---------- share with a friend ---------- */
  async function share() {
    const url = `${location.origin}${location.pathname}?ref=share`;
    const text = 'פנקס — אפליקציה לניהול הוצאות וחיסכון. חינם, בעברית, והנתונים נשארים אצלך. כשפותחים את הקישור מופיעות הוראות התקנה לאייפון או לאנדרואיד:';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'פנקס', text, url });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      api.toast('ההודעה והקישור הועתקו. אפשר להדביק בוואטסאפ.');
    } catch {
      api.toast(`הקישור: ${url}`, { ms: 9000 });
    }
  }

  /* ---------- guided tour ---------- */
  const TOUR = [
    { sel: '.hero', text: 'כמה מותר להוציא היום. מתעדכן אחרי כל הוצאה.' },
    { sel: '#btn-add', text: 'כאן רושמים הוצאה או הכנסה.' },
    { sel: '[data-tab="save"]', text: 'קופת החיסכון, המטרות ומפת הכסף שלך.' },
    { sel: '[data-tab="invest"]', text: 'השקעות: השוואת עמלות ובדיקת דמי ניהול בפנסיה.' },
    { sel: '#btn-settings', text: 'תקציבים, תזכורת ביומן ושיתוף לחבר.' },
  ];
  let tourIdx = 0;
  let tourEl = null;
  let onTourEnd = null;

  function startTour(done) {
    onTourEnd = done;
    tourIdx = 0;
    tourEl = document.createElement('div');
    tourEl.className = 'tour';
    tourEl.setAttribute('role', 'dialog');
    tourEl.setAttribute('aria-modal', 'true');
    tourEl.setAttribute('aria-label', 'סיור קצר');
    tourEl.innerHTML = `<div class="tour-hole"></div>
      <div class="tour-card"><p class="tour-step"></p><p class="tour-text"></p>
        <div class="tour-actions"><button type="button" class="btn btn-gold btn-small" data-tour="next">הבא</button><button type="button" class="link link-on-dark" data-tour="end">דילוג</button></div></div>`;
    document.body.appendChild(tourEl);
    tourEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tour]');
      if (!b) return;
      if (b.dataset.tour === 'end') endTour();
      else nextTour();
    });
    tourEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') endTour();
      if (e.key === 'Tab') { e.preventDefault(); tourEl.querySelector('[data-tour="next"]').focus(); }
    });
    window.addEventListener('resize', placeTour);
    showTour();
  }
  function showTour() {
    const step = TOUR[tourIdx];
    const target = document.querySelector(step.sel);
    if (!target) return nextTour();
    target.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    tourEl.querySelector('.tour-step').textContent = `${tourIdx + 1} מתוך ${TOUR.length}`;
    tourEl.querySelector('.tour-text').textContent = step.text;
    tourEl.querySelector('[data-tour="next"]').textContent = tourIdx === TOUR.length - 1 ? 'סיום' : 'הבא';
    setTimeout(placeTour, reduced() ? 0 : 280);
    tourEl.querySelector('[data-tour="next"]').focus({ preventScroll: true });
  }
  function placeTour() {
    if (!tourEl) return;
    const target = document.querySelector(TOUR[tourIdx].sel);
    if (!target) return;
    const r = target.getBoundingClientRect();
    const pad = 8;
    const hole = tourEl.querySelector('.tour-hole');
    Object.assign(hole.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const card = tourEl.querySelector('.tour-card');
    const below = r.bottom + 16 + 150 < innerHeight;
    card.style.top = below ? `${r.bottom + 16}px` : '';
    card.style.bottom = below ? '' : `${innerHeight - r.top + 16}px`;
  }
  function nextTour() {
    if (tourIdx < TOUR.length - 1) {
      tourIdx++;
      showTour();
    } else endTour();
  }
  function endTour() {
    window.removeEventListener('resize', placeTour);
    tourEl?.remove();
    tourEl = null;
    window.scrollTo(0, 0);
    onTourEnd?.();
  }

  return { renderIntro, afterIntroRender, introLength: SLIDES.length, renderInstall, onInstallClick, share, startTour };
}
