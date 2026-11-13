// The savings piggy: a line-drawn piggy bank that fills with gold toward the goal.
let uidN = 0;

/**
 * level: 0..1 current fill, from: 0..1 fill to animate from (optional)
 */
export function piggySVG(level, { from = null, label = '' } = {}) {
  const id = `pg${++uidN}`;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const lv = clamp(level);
  const start = from === null ? lv : clamp(from);
  // body spans y=30..136 inside the clip; liquid top moves within it
  const y = (v) => (136 - 106 * v).toFixed(1);
  return `<svg class="piggy" viewBox="0 0 220 160" role="img" aria-label="${label}" data-level="${lv}" data-from="${start}">
    <defs>
      <clipPath id="${id}-clip">
        <ellipse cx="104" cy="86" rx="74" ry="52"/>
        <rect x="166" y="66" width="28" height="34" rx="12"/>
      </clipPath>
      <linearGradient id="${id}-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#E8C76A"/>
        <stop offset="1" stop-color="#B08A2E"/>
      </linearGradient>
    </defs>
    <g class="piggy-legs">
      <rect x="54" y="122" width="16" height="26" rx="5"/>
      <rect x="82" y="128" width="16" height="22" rx="5"/>
      <rect x="118" y="128" width="16" height="22" rx="5"/>
      <rect x="146" y="122" width="16" height="26" rx="5"/>
    </g>
    <g clip-path="url(#${id}-clip)">
      <rect class="piggy-bg" x="20" y="20" width="190" height="130"/>
      <g class="piggy-liquid" style="transform:translateY(${y(start)}px)" data-target="${y(lv)}">
        <path class="piggy-wave" fill="url(#${id}-gold)" d="M-40 6 Q -20 -4 0 6 T 40 6 T 80 6 T 120 6 T 160 6 T 200 6 T 240 6 T 280 6 V 160 H -40 Z"/>
      </g>
    </g>
    <ellipse class="piggy-line" cx="104" cy="86" rx="74" ry="52"/>
    <rect class="piggy-line" x="166" y="66" width="28" height="34" rx="12"/>
    <circle class="piggy-nostril" cx="177" cy="83" r="2.6"/>
    <circle class="piggy-nostril" cx="185" cy="83" r="2.6"/>
    <circle class="piggy-eye" cx="150" cy="70" r="3.4"/>
    <path class="piggy-line" d="M132 40 L146 18 L156 44"/>
    <path class="piggy-line piggy-tail" d="M31 82 C 18 78, 16 96, 26 94 C 34 92, 28 84, 22 88"/>
    <rect class="piggy-slot" x="88" y="34" width="34" height="7" rx="3.5"/>
  </svg>`;
}

// After the SVG is in the DOM: animate the liquid from data-from to the target level.
export function settlePiggy(svg) {
  if (!svg) return;
  const liquid = svg.querySelector('.piggy-liquid');
  const target = liquid?.dataset.target;
  if (!liquid || target === undefined) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    liquid.style.transform = `translateY(${target}px)`;
  }));
}
