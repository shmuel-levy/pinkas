// The monthly story: a full-screen, tap-through walk over last month.
import * as L from './logic.js';
import { countAll, reduced, tick } from './fx.js';
import { piggySVG, settlePiggy } from './piggy.js';

export function createStory(api) {
  const { esc } = api;
  const money = (a, o) => api.money(a, o);
  const dlg = document.getElementById('story');
  const stage = document.getElementById('story-stage');
  const bars = document.getElementById('story-bars');
  let slides = [];
  let idx = 0;
  let data = null;

  const num = (a, cls = '') => `<span class="num ${cls}" data-count="${a}">${esc(money(0, { round: true }))}</span>`;

  function buildSlides(st) {
    const r = st.report;
    const monthName = L.cycleLabel(st.cycle);
    const out = [];

    out.push({
      key: 'cover',
      html: `<p class="st-kicker">${esc(monthName)}</p>
        <h2 class="st-title">החודש שלך<br>במספרים</h2>
        <div class="st-big">${num(r.spent)}</div>
        <p class="st-sub">יצאו מהחשבון${r.count ? ` ב־${r.count} רישומים` : ''}.</p>
        ${r.income ? `<div class="st-pair">
          <div><span class="st-l">נכנס</span>${num(r.income)}</div>
          <div><span class="st-l">${r.left >= 0 ? 'נשאר' : 'חסר'}</span>${num(Math.abs(r.left), r.left >= 0 ? 'st-up' : 'st-down')}</div>
        </div>` : '<p class="st-note">בלי נתוני הכנסה לחודש הזה. בצ׳ק־אין הבא אפשר להוסיף.</p>'}`,
    });

    if (st.top.length) {
      const max = st.top[0].amount;
      out.push({
        key: 'where',
        html: `<p class="st-kicker">לאן הלך הכסף</p>
          <h2 class="st-title">${esc(st.top[0].cat.name)}<br>במקום הראשון</h2>
          <ul class="st-bars">${st.top.map((t, i) => `<li style="--i:${i}">
            <span class="st-bar-l">${esc(t.cat.name)}</span>
            <span class="st-bar"><span style="--w:${((t.amount / max) * 100).toFixed(1)}%"></span></span>
            <span class="st-bar-v">${esc(money(t.amount, { round: true }))} · ${Math.round(t.share * 100)}%</span>
          </li>`).join('')}</ul>`,
      });
    }

    if (st.biggest || st.topPlace) {
      out.push({
        key: 'highlights',
        html: `<p class="st-kicker">מה בלט</p>
          ${st.biggest ? `<div class="st-card" style="--i:0"><span class="st-l">ההוצאה הכי גדולה</span>
            <strong>${esc(st.biggest.note || api.catName(st.biggest.catId))}</strong>
            <span class="st-card-v">${num(st.biggest.amount)}</span>
            <span class="st-l">${esc(L.dayLabel(st.biggest.date))}</span></div>` : ''}
          ${st.topPlace ? `<div class="st-card" style="--i:1"><span class="st-l">המקום שחזרת אליו הכי הרבה</span>
            <strong>${esc(st.topPlace.name)}</strong>
            <span class="st-card-v">${num(st.topPlace.total)}</span>
            <span class="st-l">${st.topPlace.count} פעמים, ממוצע ${esc(money(st.topPlace.avg, { round: true }))}</span></div>` : ''}`,
      });
    }

    out.push({
      key: 'good',
      html: `<p class="st-kicker">נקודות טובות</p>
        <h2 class="st-title">מה עבד</h2>
        ${r.wins.length
          ? `<ul class="st-list st-good">${r.wins.map((w, i) => `<li style="--i:${i}">${esc(w)}</li>`).join('')}</ul>`
          : '<p class="st-sub">החודש הראשון הוא נקודת הפתיחה. מהחודש הבא יהיה למה להשוות.</p>'}`,
    });

    out.push({
      key: 'learn',
      html: `<p class="st-kicker">מה כדאי ללמוד</p>
        <h2 class="st-title">${r.tips.length ? 'כאן היה אפשר לחסוך' : 'חודש נקי'}</h2>
        ${r.tips.length
          ? `<ol class="st-list st-learn">${r.tips.slice(0, 3).map((t, i) => `<li style="--i:${i}"><strong>${esc(t.title)}</strong><span>${esc(t.detail)}</span></li>`).join('')}</ol>`
          : '<p class="st-sub">לא נמצאו חריגות או הרגלים יקרים. ככה ממשיכים.</p>'}`,
    });

    const inv = st.invest;
    if (inv.monthly > 0) {
      // two curves: just saving vs saving + 6% growth, over 20 years
      const W = 300, H = 120;
      const pts = (rate) => Array.from({ length: 21 }, (_, y) => L.futureValue({ monthly: inv.monthly, years: y, annualRate: rate }));
      const grow = pts(inv.rate);
      const flat = pts(0);
      const max = grow[20];
      const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${(W - (i / 20) * W).toFixed(1)} ${(H - (v / max) * (H - 6)).toFixed(1)}`).join(' ');
      out.push({
        key: 'invest',
        html: `<p class="st-kicker">ואם היית משקיע במקום</p>
          <h2 class="st-title">${esc(money(inv.monthly, { round: true }))} בחודש<br>שלא היו יוצאים</h2>
          <div class="st-pair">
            <div><span class="st-l">אחרי 10 שנים</span>${num(inv.y10)}</div>
            <div><span class="st-l">אחרי 20 שנים</span>${num(inv.y20)}</div>
          </div>
          <svg class="st-curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="השוואה לאורך 20 שנה: הפקדה בלבד מול הפקדה עם תשואה שנתית ממוצעת של 6%">
            <path class="st-curve-flat" d="${path(flat)}"/>
            <path class="st-curve-grow" d="${path(grow)}"/>
          </svg>
          <p class="st-legend"><span><i class="lg-grow"></i>עם תשואה</span><span><i class="lg-flat"></i>רק הפקדות (${esc(money(inv.deposited10, { round: true }))} ב־10 שנים)</span></p>
          <p class="st-note">הסכום החודשי מבוסס על מה שהיה אפשר לחסוך החודש. הנחת תשואה של ${Math.round(inv.rate * 100)}% בשנה, לצורך המחשה בלבד. אין בזה הבטחה לתשואה, וזה לא ייעוץ השקעות.</p>`,
      });
    }

    if (st.nw) {
      const groups = L.ASSET_GROUPS.map((g) => ({ ...g, v: st.nw[g.key] || 0 }));
      const max = Math.max(1, ...groups.map((g) => g.v));
      out.push({
        key: 'wealth',
        html: `<p class="st-kicker">הכסף שלך · ${esc(L.monthLabelFromKey(st.nw.period))}</p>
          <div class="st-big">${num(st.nw.total)}</div>
          ${st.nwChange !== null ? `<p class="st-sub ${st.nwChange >= 0 ? 'st-up' : 'st-down'}">${st.nwChange >= 0 ? 'עלה' : 'ירד'} ב־${esc(money(Math.abs(st.nwChange), { round: true }))} מהחודש הקודם</p>` : ''}
          <ul class="st-bars">${groups.map((g, i) => `<li style="--i:${i}">
            <span class="st-bar-l">${esc(g.label)}</span>
            <span class="st-bar st-bar-gold"><span style="--w:${((g.v / max) * 100).toFixed(1)}%"></span></span>
            <span class="st-bar-v">${esc(money(g.v, { round: true }))}</span>
          </li>`).join('')}</ul>`,
      });
    }

    if (st.goal) {
      const g = st.goal;
      const room = Math.max(0, g.target - g.saved);
      const canMove = r.left > 0 && room > 0 ? Math.min(r.left, room) : 0;
      out.push({
        key: 'piggy',
        html: `<p class="st-kicker">קופת החיסכון</p>
          <h2 class="st-title">${esc(g.name)}</h2>
          <div class="st-piggy">${piggySVG(g.saved / g.target, { label: `${Math.round((g.saved / g.target) * 100)} אחוז מהמטרה` })}</div>
          <p class="st-sub" id="st-piggy-line">${esc(money(g.saved, { round: true }))} מתוך ${esc(money(g.target, { round: true }))}</p>
          ${canMove ? `<button type="button" class="btn btn-gold st-cta" data-story="deposit" data-goal="${g.id}" data-amount="${canMove}">להעביר ${esc(money(canMove, { round: true }))} שנשארו לקופה</button>` : ''}`,
      });
    }

    const ci = L.checkInStatus(api.state(), L.todayISO());
    out.push({
      key: 'end',
      html: `<p class="st-kicker">${esc(monthName)}</p>
        <h2 class="st-title">זהו.<br>חודש חדש מתחיל.</h2>
        <p class="st-sub">${r.tips[0] ? `המטרה לחודש הבא: ${esc(r.tips[0].title)}.` : 'ממשיכים באותו קצב.'}</p>
        <div class="st-actions">
          ${ci.due ? '<button type="button" class="btn btn-gold" data-story="checkin">צ׳ק־אין לחודש החדש</button>' : ''}
          <button type="button" class="btn btn-line-dark" data-story="report">לדוח המלא</button>
          <button type="button" class="link link-on-dark" data-story="close">סגירה</button>
        </div>`,
    });
    return out;
  }

  function show(i, dir = 1) {
    idx = Math.max(0, Math.min(slides.length - 1, i));
    const s = slides[idx];
    stage.className = `story-stage st-${s.key} ${reduced() ? '' : dir > 0 ? 'st-in-next' : 'st-in-prev'}`;
    stage.innerHTML = `<div class="st-inner">${s.html}</div>`;
    stage.setAttribute('aria-label', `שקופית ${idx + 1} מתוך ${slides.length}`);
    bars.querySelectorAll('span').forEach((b, k) => {
      b.classList.toggle('done', k < idx);
      b.classList.toggle('now', k === idx);
    });
    $('#story-prev').disabled = idx === 0;
    $('#story-next').textContent = idx === slides.length - 1 ? 'סיום' : 'הבא';
    countAll(stage, (v) => money(v, { round: true }));
    settlePiggy(stage.querySelector('.piggy'));
    tick(8);
  }
  const $ = (s) => document.querySelector(s);

  function open(cycle) {
    const t = L.todayISO();
    data = L.monthStory(api.state(), cycle, t);
    slides = buildSlides(data);
    bars.innerHTML = slides.map(() => '<span></span>').join('');
    api.markStorySeen(cycle);
    if (!dlg.open) dlg.showModal();
    show(0);
    $('#story-next').focus({ preventScroll: true });
  }
  function close() {
    if (dlg.open) dlg.close();
  }
  const next = () => (idx < slides.length - 1 ? show(idx + 1, 1) : close());
  const prev = () => idx > 0 && show(idx - 1, -1);

  $('#story-next').addEventListener('click', next);
  $('#story-prev').addEventListener('click', prev);
  $('#story-close').addEventListener('click', close);
  // tap zones: in RTL, the left side moves forward
  stage.addEventListener('click', (ev) => {
    if (ev.target.closest('button, a')) return;
    const r = stage.getBoundingClientRect();
    if (ev.clientX < r.left + r.width / 2) next();
    else prev();
  });
  let sx = null;
  stage.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)(); // swipe left = forward (RTL)
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); next(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); prev(); }
  });
  stage.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-story]');
    if (!b) return;
    const a = b.dataset.story;
    if (a === 'close') close();
    if (a === 'report') { close(); api.openReport(data.cycle.start); }
    if (a === 'checkin') { close(); api.openCheckIn(); }
    if (a === 'deposit') {
      const done = api.depositToGoal(b.dataset.goal, Number(b.dataset.amount), stage.querySelector('.piggy-slot'));
      if (done) {
        b.remove();
        const g = api.state().goals.find((x) => x.id === b.dataset.goal);
        const svg = stage.querySelector('.piggy');
        if (svg && g) {
          svg.outerHTML = piggySVG(g.saved / g.target, { from: Number(svg.dataset.level), label: `${Math.round((g.saved / g.target) * 100)} אחוז מהמטרה` });
          settlePiggy(stage.querySelector('.piggy'));
          stage.querySelector('#st-piggy-line').textContent = `${money(g.saved, { round: true })} מתוך ${money(g.target, { round: true })}`;
        }
      }
    }
  });

  return { open, close };
}
