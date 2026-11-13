// The "השקעות" tab: asks where you stand, a short questionnaire, then a tailored page.
import * as L from './logic.js';
import * as I from './invest.js';

export function createInvest(api) {
  const { esc } = api;
  const money = (a, o) => api.money(a, o);
  const m = (a, o) => `<span class="num">${esc(money(a, o))}</span>`;
  // questionnaire progress (in memory until finished)
  const q = { step: 0, draft: {} };

  const STATUS = [
    { key: 'investing', label: 'כבר יש לי השקעות', sub: 'תיק, גמל להשקעה או קרן השתלמות' },
    { key: 'invested', label: 'השקעתי בעבר', sub: 'ורוצה לחזור בצורה מסודרת' },
    { key: 'want', label: 'רוצה להתחיל להשקיע', sub: 'ולא בטוח/ה מאיפה' },
  ];
  const MARKETS = [
    { key: 'ta', label: 'בבורסה בתל אביב', sub: 'קרנות סל ומניות ישראליות, בשקלים' },
    { key: 'us', label: 'ישירות בארה״ב', sub: 'מניות וקרנות סל אמריקאיות, בדולרים' },
    { key: 'unsure', label: 'עוד לא יודע/ת', sub: 'נחשב לפי תל אביב' },
  ];

  const inv = () => api.state().invest;

  function steps() {
    const list = [];
    if (inv().status === 'investing') list.push('broker');
    list.push('horizon', 'goal', 'money', 'market');
    return list;
  }

  function optionList(name, options, current) {
    return `<div class="inv-options" role="radiogroup" aria-label="${esc(name)}">${options.map((o) => `
      <button type="button" class="inv-option" role="radio" aria-checked="${current === o.key}" data-inv="pick" data-value="${esc(o.key)}">
        <span class="inv-option-l">${esc(o.label)}</span>${o.sub ? `<span class="inv-option-s">${esc(o.sub)}</span>` : ''}
      </button>`).join('')}</div>`;
  }

  function renderStatus() {
    return `<section class="inv-hero vault" aria-labelledby="inv-h">
        <p class="vault-label">השקעות ושוק ההון</p>
        <h2 class="inv-title" id="inv-h">מה המצב שלך עם השקעות?</h2>
        <p class="hero-sub">לפי התשובה פנקס יתאים את העמוד: השוואת עמלות בין בתי ההשקעות, בדיקת דמי ניהול בפנסיה, ומה כדאי לדעת לפני שמתחילים.</p>
      </section>
      <section>${optionList('המצב שלך', STATUS, inv().status)}</section>
      ${disclaimer()}`;
  }

  function renderQuestion() {
    const list = steps();
    const key = list[q.step];
    const d = q.draft;
    let body = '';
    let title = '';
    if (key === 'broker') {
      title = 'איפה התיק שלך היום?';
      body = optionList('בית ההשקעות', [...I.BROKERS.filter((b) => b.kind !== 'bank').map((b) => ({ key: b.id, label: b.name })), { key: 'bank', label: 'בבנק' }, { key: 'other', label: 'אחר' }], d.broker);
    } else if (key === 'horizon') {
      title = 'לכמה זמן הכסף יכול להיות מושקע?';
      body = optionList('טווח ההשקעה', I.HORIZONS, d.horizon);
    } else if (key === 'goal') {
      title = 'בשביל מה?';
      body = optionList('המטרה', I.GOALS, d.goal);
    } else if (key === 'money') {
      title = 'כמה כסף מדובר?';
      body = `<div class="form-field"><label for="inv-lump">סכום חד־פעמי להתחלה</label>
          <div class="money-field"><input id="inv-lump" class="field" inputmode="decimal" autocomplete="off" value="${d.lump ? d.lump / 100 : ''}" placeholder="0"><span class="cur" aria-hidden="true">${esc(api.state().settings.currency)}</span></div></div>
        <div class="form-field"><label for="inv-monthly">הפקדה חודשית</label>
          <div class="money-field"><input id="inv-monthly" class="field" inputmode="decimal" autocomplete="off" value="${d.monthly ? d.monthly / 100 : ''}" placeholder="0"><span class="cur" aria-hidden="true">${esc(api.state().settings.currency)}</span></div>
          <span class="hint">${monthlyHint()}</span></div>
        <p class="form-error" id="inv-error" role="alert"></p>
        <button type="button" class="btn btn-primary inv-next" data-inv="money-next">המשך</button>`;
    } else if (key === 'market') {
      title = 'איפה הכי מעניין אותך לקנות?';
      body = optionList('איפה', MARKETS, d.market);
    }
    return `<section class="inv-q">
        <div class="inv-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${list.length}" aria-valuenow="${q.step + 1}" aria-label="שאלה ${q.step + 1} מתוך ${list.length}">
          ${list.map((_, i) => `<span class="${i <= q.step ? 'on' : ''}"></span>`).join('')}
        </div>
        <p class="eyebrow">שאלה ${q.step + 1} מתוך ${list.length}</p>
        <h2 class="inv-q-title">${esc(title)}</h2>
        ${body}
        <button type="button" class="link" data-inv="back">${q.step ? 'חזרה לשאלה הקודמת' : 'חזרה'}</button>
      </section>`;
  }

  function monthlyHint() {
    const st = api.state();
    const cyc = L.lastFinishedCycle(st, L.todayISO());
    const r = L.monthlyReport(st, cyc, L.todayISO());
    return r.income && r.left > 0 ? `בחודש שעבר נשארו לך ${money(r.left, { round: true })}.` : 'גם ₪200 בחודש זה התחלה.';
  }

  function liquidNow() {
    const series = L.netWorthSeries(api.state().snapshots);
    return series.length ? series[series.length - 1].liquid : 0;
  }

  function renderResults() {
    const st = api.state();
    const p = inv().profile;
    const t = L.todayISO();
    const plan = I.investPlan(p, { avgSpend: L.avgMonthlySpend(st, t), liquid: liquidNow() }, st.settings.currency);
    const horizon = I.HORIZONS.find((h) => h.key === p.horizon)?.label;
    const goal = I.GOALS.find((g) => g.key === p.goal)?.label;
    const parts = [];

    parts.push(`<section class="inv-hero vault" aria-labelledby="inv-h">
      <p class="vault-label">${esc(STATUS.find((s) => s.key === inv().status)?.label || '')}</p>
      <h2 class="inv-title" id="inv-h">התוכנית שלך</h2>
      <ul class="inv-chips">
        <li><span>טווח</span>${esc(horizon)}</li>
        <li><span>מטרה</span>${esc(goal)}</li>
        <li><span>חודשי</span>${esc(money(p.monthly, { round: true }))}</li>
        ${p.lump ? `<li><span>להתחלה</span>${esc(money(p.lump, { round: true }))}</li>` : ''}
      </ul>
      <div class="inv-hero-actions">
        <button type="button" class="link link-on-dark" data-inv="redo">לשנות תשובות</button>
        <button type="button" class="link link-on-dark" data-inv="reset">להתחיל מחדש</button>
      </div>
    </section>`);

    if (inv().status === 'investing') parts.push(renderPortfolio());

    parts.push(`<section aria-labelledby="inv-notes-h">
      <div class="sec-head"><h2 class="sec-title" id="inv-notes-h">מה חשוב לדעת</h2></div>
      <ol class="tips">${plan.notes.map((n) => `<li><p class="tip-title">${esc(n.title)}</p><p class="tip-detail">${esc(n.text)}</p></li>`).join('')}</ol>
    </section>`);

    if (p.monthly || p.lump) {
      const max = Math.max(...plan.projection.map((x) => x.value), plan.deposited, 1);
      parts.push(`<section class="section-gap" aria-labelledby="inv-proj-h">
        <div class="sec-head"><h2 class="sec-title" id="inv-proj-h">איך זה יכול להיראות בעוד ${plan.years === 1 ? 'שנה' : `${plan.years} שנים`}</h2></div>
        <ul class="shares">
          <li><span class="sh-name">רק הפקדות</span><span class="sh-bar sh-flat" aria-hidden="true"><span style="width:${((plan.deposited / max) * 100).toFixed(1)}%"></span></span><span class="sh-val">${m(plan.deposited, { round: true })}</span></li>
          ${plan.projection.map((x) => `<li><span class="sh-name">${Math.round(x.rate * 100)}% בשנה</span><span class="sh-bar" aria-hidden="true"><span style="width:${((x.value / max) * 100).toFixed(1)}%"></span></span><span class="sh-val">${m(x.value, { round: true })}</span></li>`).join('')}
        </ul>
        <p class="small muted">תרחישים להמחשה בלבד, לפני מסים ועמלות. השוק יכול גם לרדת, ותשואות עבר לא מבטיחות תשואות עתידיות.</p>
      </section>`);
    }

    if (plan.selfDirected || inv().status === 'investing') parts.push(renderBrokers(p));
    parts.push(renderPension());
    parts.push(disclaimer());
    return parts.join('');
  }

  function renderPortfolio() {
    const series = L.netWorthSeries(api.state().snapshots);
    const last = series[series.length - 1];
    if (!last) {
      return `<section class="section-gap"><p class="block-p">כדי לראות כאן את התיק שלך, מזינים את הסכומים בצ׳ק־אין החודשי.</p><button type="button" class="btn btn-line btn-small" data-inv="checkin">לצ׳ק־אין</button></section>`;
    }
    const rows = L.ASSET_TYPES.filter((a) => a.group !== 'liquid' && last.assets[a.key]);
    return `<section aria-labelledby="inv-pf-h">
      <div class="sec-head"><h2 class="sec-title" id="inv-pf-h">התיק שלך</h2><button type="button" class="link" data-inv="checkin">עדכון</button></div>
      ${rows.length ? `<ul class="kv">${rows.map((a) => `<li><span>${esc(a.label)}</span>${m(last.assets[a.key], { round: true })}</li>`).join('')}
        <li><strong>סה״כ השקעות וחיסכון לטווח ארוך</strong><strong>${m(last.invest + last.longterm, { round: true })}</strong></li></ul>`
      : '<p class="block-p">בצ׳ק־אין האחרון לא הוזנו השקעות. אפשר לעדכן שם.</p>'}
    </section>`;
  }

  function renderBrokers(p) {
    const profile = { market: p.market, monthly: p.monthly, lump: p.lump };
    const list = I.compareBrokers(profile);
    const avail = list.filter((x) => x.cost.available);
    const cheapest = avail[0];
    const mine = inv().status === 'investing' ? list.find((x) => x.broker.id === inv().broker) : null;
    const venue = p.market === 'us' ? 'ארה״ב' : 'תל אביב';
    let summary = '';
    if (!p.monthly && !p.lump) {
      summary = '<p class="block-p">הזינו סכום בשאלון כדי לראות כמה זה יעלה בכל בית השקעות.</p>';
    } else if (mine && mine.cost.available && cheapest && mine.broker.id !== cheapest.broker.id) {
      const save = mine.cost.total - cheapest.cost.total;
      summary = `<p class="callout">אצל ${esc(mine.broker.name)} זה עולה בערך ${m(mine.cost.total, { round: true })} בשנה. ב${esc(cheapest.broker.name)}: ${m(cheapest.cost.total, { round: true })}. הפרש של כ־<strong>${m(save, { round: true })} בשנה</strong>.</p>`;
    } else if (cheapest) {
      summary = `<p class="callout">לפרופיל שלך (${esc(money(p.monthly, { round: true }))} בחודש, ${venue}) העלות הנמוכה ביותר: <strong>${esc(cheapest.broker.name)}</strong>, כ־${m(cheapest.cost.total, { round: true })} בשנה.</p>`;
    }
    if (p.market === 'us' && (p.monthly || p.lump)) {
      summary += '<p class="block-p"><strong>שימו לב:</strong> בהשקעה בדולרים, מרווח ההמרה משקל לדולר (בדוגמאות שפורסמו כ־0.5%–0.7% מכל הפקדה) יכול להיות גדול מהעמלות עצמן — והוא לא כלול בחישוב. כדאי לבדוק אותו בכל בית השקעות.</p>';
    }
    return `<section class="section-gap" aria-labelledby="inv-br-h">
      <div class="sec-head"><h2 class="sec-title" id="inv-br-h">השוואת בתי השקעות</h2><span class="small muted">מסחר ב${venue}</span></div>
      ${summary}
      <ol class="brokers">${list.map((x, i) => {
        const b = x.broker;
        const c = x.cost;
        const isMine = mine && mine.broker.id === b.id;
        const venueFee = p.market === 'us'
          ? (b.us ? (b.us.freeTrades ? `חינם עד ${b.us.freeTrades} פעולות, אחר כך מינימום $${b.us.min}` : `מינימום ${b.us.minRange || `$${b.us.min}`} לפעולה`) : 'לא זמין')
          : (b.ta ? `${b.ta.rateRange || `${(b.ta.rate * 100).toFixed(2).replace(/0$/, '')}%`}, מינימום ₪${b.ta.min}` : 'לא זמין ללקוחות פרטיים');
        return `<li class="broker${c.available && i === 0 ? ' is-best' : ''}${isMine ? ' is-mine' : ''}${c.available ? '' : ' is-na'}">
          <div class="broker-top">
            <span class="broker-name">${esc(b.name)}${c.available && i === 0 ? ' <span class="badge">הכי זול לפרופיל שלך</span>' : ''}${isMine ? ' <span class="badge badge-line">שלך</span>' : ''}</span>
            <span class="broker-cost">${c.available ? `${m(c.total, { round: true })}<span class="small muted"> לשנה</span>` : '<span class="small muted">לא זמין</span>'}</span>
          </div>
          <dl class="broker-facts">
            <div><dt>עמלת קנייה</dt><dd>${esc(venueFee)}</dd></div>
            <div><dt>דמי טיפול</dt><dd>${b.custodyPct ? `${b.custodyPct * 100}% מהתיק בשנה` : b.monthly ? `₪${b.monthly} לחודש${b.offset ? ', מתקזז מול עמלות' : ''}` : 'פטור'}</dd></div>
            <div><dt>המרת מט״ח</dt><dd>${esc(b.fx)}</dd></div>
            <div><dt>מינימום לפתיחה</dt><dd>${b.minDeposit ? esc(b.minDepositRange || money(b.minDeposit * 100, { round: true })) : 'אין'}${x.belowMin ? ' <span class="warn-text">(יותר מהסכום שלך)</span>' : ''}</dd></div>
          </dl>
          ${b.promo || b.note ? `<p class="broker-note">${esc([b.promo, b.note].filter(Boolean).join('. '))}</p>` : ''}
        </li>`;
      }).join('')}</ol>
      <p class="small muted">העלות השנתית היא הערכה: קנייה אחת בכל הפקדה, בלי מבצעי הצטרפות, ובלי מרווח המרת מט״ח${p.market === 'us' ? `. דולר מחושב לפי ₪${I.USD_ILS}` : ''}. התעריפים נבדקו ב${I.FEES_CHECKED} מול ${I.FEE_SOURCES.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(', ')}. המקורות לא תמיד מסכימים, ובמקרה כזה החישוב לוקח את הערך היקר. לפני שפותחים חשבון — לבדוק בתעריפון הרשמי.</p>
    </section>`;
  }

  function pensionInputs() {
    const st = api.state();
    const series = L.netWorthSeries(st.snapshots);
    const bal = series.length ? series[series.length - 1].assets.pension || 0 : 0;
    const pp = inv().pension || { monthly: 0, depositFee: 0, savingsFee: 0 };
    return { balance: bal, ...pp };
  }

  function pensionResult() {
    const x = pensionInputs();
    if (!x.balance && !x.monthly) return '<p class="small muted">מזינים צבירה (בצ׳ק־אין) או הפקדה חודשית כדי לראות את החישוב.</p>';
    if (!x.depositFee && !x.savingsFee) return '<p class="small muted">מזינים את דמי הניהול שלך. הם מופיעים בדוח השנתי או באפליקציה של הקרן.</p>';
    const mine = I.pensionFees({ balance: x.balance, monthly: x.monthly, depositFee: x.depositFee, savingsFee: x.savingsFee });
    const good = I.pensionFees({ balance: x.balance, monthly: x.monthly, depositFee: Math.min(x.depositFee, I.PENSION_GOOD.deposit), savingsFee: Math.min(x.savingsFee, I.PENSION_GOOD.savings) });
    const diff = good.endBalance - mine.endBalance;
    return `<ul class="kv">
        <li><span>דמי ניהול ב־20 שנה, בתנאים שלך</span>${m(mine.paid, { round: true })}</li>
        <li><span>בתנאים טובים (${I.PENSION_GOOD.deposit * 100}% מהפקדה, ${(I.PENSION_GOOD.savings * 100).toFixed(2)}% מצבירה)</span>${m(good.paid, { round: true })}</li>
      </ul>
      ${diff > 0 ? `<p class="callout">הפרש בצבירה בסוף התקופה: <strong>${m(diff, { round: true })}</strong>. אפשר לבקש מהקרן להוריד דמי ניהול, או לעבור קרן — בדרך כלל בטלפון אחד.</p>`
        : '<p class="callout">דמי הניהול שלך כבר טובים. אין כאן מה לשפר.</p>'}
      <p class="small muted">חישוב בהנחת תשואה של 5% בשנה. התקרה בחוק: עד 6% מההפקדה ועד 0.5% מהצבירה.</p>`;
  }

  function renderPension() {
    const x = pensionInputs();
    const pct = (v) => (v ? +(v * 100).toFixed(2) : '');
    return `<section class="section-gap" aria-labelledby="inv-pen-h">
      <div class="sec-head"><h2 class="sec-title" id="inv-pen-h">בדיקת דמי ניהול בפנסיה</h2></div>
      <p class="block-p">דמי ניהול גבוהים בפנסיה הם אחד הדליפות הכי יקרות — ושקטות. ${x.balance ? `הצבירה שלך לפי הצ׳ק־אין: ${esc(money(x.balance, { round: true }))}.` : ''}</p>
      <div class="pen-grid">
        <div class="form-field"><label for="pen-monthly">הפקדה חודשית</label><div class="money-field"><input id="pen-monthly" class="field" inputmode="decimal" data-pension="monthly" value="${x.monthly ? x.monthly / 100 : ''}" placeholder="0"><span class="cur" aria-hidden="true">₪</span></div></div>
        <div class="form-field"><label for="pen-dep">דמי ניהול מהפקדה (%)</label><input id="pen-dep" class="field" inputmode="decimal" data-pension="depositFee" value="${pct(x.depositFee)}" placeholder="למשל 1.5"></div>
        <div class="form-field"><label for="pen-sav">דמי ניהול מצבירה (%)</label><input id="pen-sav" class="field" inputmode="decimal" data-pension="savingsFee" value="${pct(x.savingsFee)}" placeholder="למשל 0.22"></div>
      </div>
      <div id="pension-out" aria-live="polite">${pensionResult()}</div>
    </section>`;
  }

  function disclaimer() {
    return `<p class="inv-disclaimer">המידע כאן כללי ונועד לעזור להבין עלויות ואפשרויות. הוא לא ייעוץ השקעות, לא שיווק השקעות ולא תחליף לייעוץ מבעל רישיון שמתחשב בכל הנתונים שלך.</p>`;
  }

  function render() {
    if (!inv().status) return renderStatus();
    if (!inv().profile || q.active) {
      q.active = true;
      return renderQuestion();
    }
    return renderResults();
  }

  function rerender() {
    api.render();
    window.scrollTo(0, 0);
  }

  // event handling (delegated from #view)
  function onClick(el) {
    const a = el.dataset.inv;
    const st = api.state();
    if (a === 'pick') {
      const v = el.dataset.value;
      if (!st.invest.status) {
        st.invest.status = v;
        q.step = 0;
        q.draft = { ...(st.invest.profile || {}), broker: st.invest.broker };
        q.active = true;
        api.persist();
        return rerender();
      }
      const key = steps()[q.step];
      q.draft[key] = v;
      return advance();
    }
    if (a === 'money-next') {
      const lump = readMoney('#inv-lump');
      const monthly = readMoney('#inv-monthly');
      if (lump === null || monthly === null) {
        document.querySelector('#inv-error').textContent = 'הסכומים צריכים להיות מספרים, למשל 500.';
        return;
      }
      q.draft.lump = lump;
      q.draft.monthly = monthly;
      return advance();
    }
    if (a === 'back') {
      if (q.step > 0) q.step--;
      else if (st.invest.profile) { q.active = false; }
      else { st.invest.status = null; q.active = false; api.persist(); }
      return rerender();
    }
    if (a === 'redo') {
      q.step = 0;
      q.draft = { ...st.invest.profile, broker: st.invest.broker };
      q.active = true;
      return rerender();
    }
    if (a === 'reset') {
      st.invest.status = null;
      st.invest.profile = null;
      q.active = false;
      api.persist();
      return rerender();
    }
    if (a === 'checkin') api.openCheckIn();
  }

  function readMoney(sel) {
    const raw = document.querySelector(sel)?.value.trim() || '';
    return raw ? L.parseAmount(raw) : 0;
  }

  function advance() {
    const list = steps();
    if (q.step < list.length - 1) {
      q.step++;
      return rerender();
    }
    const st = api.state();
    const d = q.draft;
    st.invest.profile = { horizon: d.horizon || 'long', goal: d.goal || 'grow', lump: d.lump || 0, monthly: d.monthly || 0, market: d.market === 'us' ? 'us' : 'ta' };
    if (d.broker) st.invest.broker = d.broker;
    q.active = false;
    q.step = 0;
    api.commit();
    window.scrollTo(0, 0);
    api.toast('התוכנית מוכנה');
  }

  function onInput(el) {
    if (!el.dataset.pension) return false;
    const st = api.state();
    const p = st.invest.pension || { monthly: 0, depositFee: 0, savingsFee: 0 };
    const k = el.dataset.pension;
    const raw = el.value.trim().replace('%', '');
    if (k === 'monthly') {
      const a = raw ? L.parseAmount(raw) : 0;
      if (a === null) return true;
      p.monthly = a;
    } else {
      const v = raw ? Number(raw) / 100 : 0;
      if (!Number.isFinite(v) || v < 0) return true;
      p[k] = Math.min(k === 'depositFee' ? I.PENSION_CAPS.deposit : I.PENSION_CAPS.savings, v);
    }
    st.invest.pension = p;
    api.persist();
    const out = document.getElementById('pension-out');
    if (out) out.innerHTML = pensionResult();
    return true;
  }

  return { render, onClick, onInput, isActive: () => !!q.active };
}
