// Motion helpers. Every effect checks prefers-reduced-motion and degrades to the final state.

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Animates a number inside `el` from 0 (or data-from) to `to`, formatting each frame.
export function countUp(el, to, format, { duration = 900, from = 0 } = {}) {
  if (!el) return;
  if (reduced() || to === from) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    // rAF timestamps can be slightly earlier than `start`: clamp so the number never dips below `from`
    const t = Math.max(0, Math.min(1, (now - start) / duration));
    el.textContent = format(Math.round(from + (to - from) * easeOut(t)));
    if (t < 1) requestAnimationFrame(step);
  };
  el.textContent = format(from);
  requestAnimationFrame(step);
}

// Runs countUp on every [data-count] element inside root (value in agorot).
export function countAll(root, format, opts) {
  root.querySelectorAll('[data-count]').forEach((el, i) => {
    const to = Number(el.dataset.count);
    setTimeout(() => countUp(el, to, (v) => format(v, el), opts), i * 90);
  });
}

// A coin that drops into the element (e.g. the piggy slot).
export function coinDrop(target) {
  if (!target || reduced()) return;
  const r = target.getBoundingClientRect();
  const coin = document.createElement('div');
  coin.className = 'fx-coin';
  coin.setAttribute('aria-hidden', 'true');
  coin.style.left = `${r.left + r.width / 2 - 14}px`;
  coin.style.top = `${r.top - 70}px`;
  document.body.appendChild(coin);
  coin.addEventListener('animationend', () => coin.remove());
}

// Coins and notes bursting out of a point.
export function burst(host, { count = 34 } = {}) {
  if (!host || reduced()) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    const note = i % 4 === 0;
    p.className = note ? 'fx-bit fx-note' : 'fx-bit fx-coinbit';
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = 120 + Math.random() * 160;
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist - 60}px`);
    p.style.setProperty('--rot', `${Math.round(Math.random() * 720 - 360)}deg`);
    p.style.setProperty('--d', `${Math.round(Math.random() * 120)}ms`);
    p.setAttribute('aria-hidden', 'true');
    frag.appendChild(p);
  }
  host.appendChild(frag);
  setTimeout(() => host.querySelectorAll('.fx-bit').forEach((b) => b.remove()), 2200);
}

// Light vibration where supported (Android); silently ignored elsewhere.
export function tick(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}
