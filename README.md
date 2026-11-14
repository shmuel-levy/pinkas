# שקל בצד (ShekelBatzad) — אפליקציית הוצאות אישית

אפליקציית ווב (PWA) לאייפון, בנויה ב־**React + Redux Toolkit + Vite + SCSS**: נפתחת ממסך הבית כמו אפליקציה רגילה, עובדת בלי אינטרנט, ושומרת את הנתונים רק בטלפון.
בלי שרת, בלי חשבון, בלי תשלום.

## מה יש בפנים

**שליטה בתקציב**
- **״אפשר להוציא היום״**: כמה כסף מותר להוציא היום כדי לסיים את החודש בתקציב. החשבון כבר מוריד חיובים קבועים שעוד לא ירדו.
- **מעטפות**: תקציב לכל קטגוריה. הפס מראה כמה כבר הוצאת, והקו הקטן מסמן איפה היית אמור להיות היום.
- **אוכל בחוץ במרכז המסך**: כמה נשאר, כמה מותר ליום, ותחזית לפי הקצב. אפשר להחליף להתמקד בקטגוריה אחרת.

**התראות לפני חריגה**
- בזמן שמקלידים סכום רואים מיד: ״אחרי זה נשארו ₪X״, או באדום ״זה יעבור את התקציב ב־₪Y״.
- כשהוצאה עומדת לעבור את התקציב, האפליקציה עוצרת ושואלת. אפשר ללחוץ ״ויתרתי״, והסכום נרשם כחיסכון.
- כשעוברים 80% מהתקציב (ניתן לשינוי) מופיעה אזהרה, וגם כשהקצב מראה שתחרוג עד סוף החודש.

**חיסכון**
- **ויתורים**: מתעדים כל דבר שוויתרת עליו ורואים כמה כסף נשאר אצלך.
- **מטרות חיסכון** עם מעקב התקדמות. אפשר להעביר ויתור ישר למטרה.
- **רשימת המתנה**: קנייה לא מתוכננת מחכה 48 שעות (ניתן לשינוי), ואחר כך מחליטים אם לקנות או לוותר.
- **לוח ימים בלי הוצאות**, כולל רצף.
- **טיפ אישי**: ״פעם אחת פחות בשבוע = ₪X בשנה״, מחושב מההרגלים שלך.

**צ׳ק־אין חודשי (ב־10 לחודש, ניתן לשינוי)**
- בכל חודש האפליקציה שואלת כמה כסף נכנס, כמה יש בעו״ש ובמזומן, כמה שוות ההשקעות וכמה יש בחיסכון.
- **השווי שלך**: סה״כ ההון, השינוי מהחודש הקודם, גרף לאורך זמן וחלוקה בין עו״ש, השקעות וחיסכון.
- **תזכורת אמיתית באייפון**: בהגדרות לוחצים ״הוספה ליומן״. נוצר אירוע חוזר כל חודש עם התראה ב־9:00.
  > אפליקציה שמותקנת ממסך הבית לא יכולה לשלוח התראה מתוזמנת בלי שרת בתשלום. היומן של האייפון עושה את זה בחינם.
- מעבר לזה, בפתיחה הראשונה מה־10 לחודש הצ׳ק־אין נפתח לבד.

**סיכום חודשי**
- בסוף כל מחזור מופיעה הודעה: ״הסיכום מוכן״.
- **הכנסות מול הוצאות**: כמה נשאר בסוף החודש, שיעור החיסכון, וחלוקה בין הוצאות קבועות למשתנות.
- **איפה אפשר להשתפר**: עד 4 המלצות לפי הנתונים שלך, כל אחת עם סכום החיסכון האפשרי. למשל חריגות, מקום שחוזרים אליו הרבה, קטגוריה שקפצה, חיובים קבועים קטנים, יום יקר בשבוע או שיעור חיסכון נמוך.
- **מה הלך טוב**, השינוי בשווי שלך, ופירוט לפי קטגוריה.

**ביטוחים והוצאות שנתיות**
- ביטוח רכב של ₪3,600 לשנה נרשם כ־₪300 בכל חודש, כך שאף חודש לא ״נפגע״ לבד.
- **איפה:** בהגדרות ← ״ביטוחים והוצאות שנתיות״, או מתוך מסך ההוצאה: ״ביטוח או הוצאה שנתית? לפרוס על השנה״.
- **תקופה:** אפשר לפרוס על 12 חודשים (ברירת המחדל), 6, 3 או 24.
- **חלוקה מדויקת:** הסכום מתחלק עד האגורה, וכל חודש תקציבי מקבל בדיוק חלק אחד.
- **תזכורת חידוש:** 30 יום לפני שהפוליסה מסתיימת מופיעה הודעה ״מתחדש בעוד X ימים — זה הזמן להשוות מחירים״. כפתור ״חידוש״ יוצר את השנה הבאה.

**זיכרון מקומות**
- אחרי 2 הוצאות עם אותו שם (למשל ״ארומה״), שקל בצד זוכר את המקום.
- בפעם הבאה הוא מציע אותו כבר בזמן ההקלדה, בוחר לבד את הקטגוריה, ואם המחיר קבוע ממלא גם את הסכום.
- בהגדרות ← ״מקומות שזכרתי״ אפשר לשנות לכל מקום קטגוריה או לבקש לשכוח אותו.

**תובנות**
- גרף של 6 החודשים האחרונים.
- השוואה הוגנת לחודש הקודם, מול אותה נקודת זמן בחודש.
- היום בשבוע שבו הולך הכי הרבה כסף.
- כמה עולים כל המנויים והחיובים הקבועים בשנה.

**עוד**
- הוצאות קבועות (שכירות, מנויים) נרשמות לבד כל חודש.
- אפשר להתחיל את חודש התקציב ביום המשכורת (למשל ב־10 לחודש).
- חיפוש וסינון ביומן, עריכה ומחיקה עם ״ביטול״.
- בחירות מהירות להוצאות שחוזרות על עצמן (״קפה ₪14״).
- מצב כהה, תמיכה בקורא מסך, ונבדק ללא שגיאות נגישות (axe).
- גיבוי ושחזור (JSON) וייצוא לאקסל (CSV).

## התקנה באייפון בחינם

כדי שספארי יוכל להתקין את האפליקציה, היא צריכה להיות באתר עם כתובת https.

### GitHub Pages (כל עדכון עולה לבד)
יש בפרויקט תהליך אוטומטי (`.github/workflows/pages.yml`): בכל העלאה ל־main הוא מתקין, מריץ את כל הבדיקות, בונה עם Vite, ורק אם הכל עבר — מפרסם את `dist`.

**פעם ראשונה:** במאגר ב־GitHub נכנסים ל־Settings ← Pages, ותחת Source בוחרים **GitHub Actions**. הכתובת תהיה `https://<שם-משתמש>.github.io/pinkas/`.

**כל עדכון אחר כך:**
```bash
git add -A && git commit -m "עדכון" && git push
```
אין צורך להעלות מספר גרסה ידנית: הבנייה מחשבת חתימה לקבצים, ובפתיחה הבאה תופיע הודעה ״יש גרסה חדשה״.

### Netlify Drop (בלי GitHub)
מריצים `npm run build` וגוררים את התיקייה **`dist`** ל־https://app.netlify.com/drop.

> **פרטיות:** במאגר יש רק את הקוד. ההוצאות, ההכנסות והשווי שלך נשמרים רק בטלפון ולא עולים לשום מקום.

### ואז בטלפון
1. פותחים את הכתובת **בספארי** (לא בכרום).
2. לוחצים על כפתור השיתוף (ריבוע עם חץ למעלה).
3. בוחרים ״הוספה למסך הבית״.

> **חשוב:** הנתונים שמורים רק בטלפון. פעם בחודש כדאי ללחוץ על הגדרות ← ״שמירת גיבוי״ ולשמור את הקובץ ב־iCloud Drive.

## בדרך ל־App Store
אין שרת וכל הנתיבים יחסיים, אז אפשר לעטוף את `dist` עם [Capacitor](https://capacitorjs.com):
`npx cap init ShekelBatzad com.yourname.shekelbatzad --web-dir=dist`, ואז `npx cap add ios` ו־Xcode (צריך מק וחשבון Apple Developer).

---

## Tech stack & architecture

**React 19 · Redux Toolkit · Vite · SCSS · PWA (Service Worker) · Vitest + React Testing Library · GitHub Actions CI/CD**

**ShekelBatzad** ("a shekel on the side") is a mobile-first, offline-first personal finance PWA in Hebrew (RTL). No backend: all data stays on the device.

| Layer | What's there |
| --- | --- |
| **UI** | React 19 function components and hooks (`src/pages`, `src/components`, `src/sheets`). Native `<dialog>` sheets with focus trapping, a guided tour, an animated monthly "story", SVG charts built by hand. |
| **State** | Redux Toolkit: a `data` slice (everything saved: expenses, incomes, budgets, goals, snapshots…) and a `ui` slice (navigation, ledger filters, questionnaires). Reducers stay pure; ids and timestamps are created in `prepare`. Transient overlays (toasts, sheets) live in a small React context. |
| **Persistence** | The store is persisted to `localStorage` on every change, with schema normalisation/migration so data from the earlier vanilla-JS version (v1.x) loads unchanged. JSON backup/restore and CSV export. |
| **Domain logic** | `src/lib/logic.js` — pure, framework-free functions: budget cycles, per-day allowance, over-budget impact, recurring charges, insurance spread over 12 months, net worth, live balances, streaks, savings tips. `src/lib/invest.js` — broker fee comparison and pension-fee calculator. |
| **Styling** | SCSS partials with a design-token map, a `theme` mixin generating light/dark CSS variables, breakpoint and reduced-motion mixins. |
| **PWA** | A custom Vite plugin injects the built file list and a content hash into the service worker, so the app works fully offline and every deploy reaches installed phones as an update. |
| **Personalisation** | First-run questions (name, experience, main goal) adapt the app: a greeting by name, a first-steps checklist and short explanations for beginners, fewer prompts for experienced users. Any date in any calendar opens a day view with everything that happened that day. |
| **Testing** | 95 unit tests for the domain logic (`node:test`) + 25 Vitest/RTL tests that drive the real app: onboarding, adding an expense through the pay step, the over-budget stop, the budget questionnaire, the monthly check-in with USD conversion, goals, investments, and loading data saved by the previous version. |
| **CI/CD** | GitHub Actions: `npm ci` → tests → `vite build` → deploy to GitHub Pages, on every push to `main`. |
| **Accessibility** | Checked with axe-core on every page and sheet, in light and dark mode; no horizontal overflow at 320px. |

## פיתוח ובדיקות
```bash
npm install
```
```bash
npm run dev        # http://localhost:5178
```
```bash
npm test           # 95 בדיקות לוגיקה + 25 בדיקות ממשק (Vitest + Testing Library)
```
```bash
npm run build      # dist/ לפרסום
```

- `src/lib/logic.js`: כל החישובים (תקציב, מחזורים, חיובים קבועים, תובנות). בלי DOM, ולכן נבדק ב־Node.
- `src/lib/storage.js`: שמירה, ולידציה של גיבויים ותיקון נתונים פגומים.
- `src/store/`: Redux — `dataSlice` (כל מה שנשמר) ו־`uiSlice` (ניווט ומסננים).
- `src/pages/`, `src/sheets/`, `src/components/`: הממשק ב־React.
- `src/styles/`: SCSS, עם טוקנים לעיצוב בהיר וכהה.
- `public/sw.js`: עבודה בלי אינטרנט (רשימת הקבצים נכתבת בזמן הבנייה ב־`vite.config.js`).
- `tools/make-icons.ps1`, `tools/make-guilloche.mjs`: יוצרים מחדש את האייקונים ואת דוגמת השטר.
