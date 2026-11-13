// The savings piggy: line-drawn, fills with gold toward the goal. `from` animates the fill on mount.
import { useEffect, useId, useLayoutEffect, useRef } from 'react';

const clamp = (v) => Math.max(0, Math.min(1, v));
const liquidY = (v) => (136 - 106 * v).toFixed(1);

export function Piggy({ level, from = null, label = '' }) {
  const id = useId().replace(/:/g, '');
  const lv = clamp(level);
  const start = from === null ? lv : clamp(from);
  const liquid = useRef(null);
  // start level is set once, before paint; after that only the effect below moves it (CSS transition animates)
  useLayoutEffect(() => {
    if (liquid.current) liquid.current.style.transform = `translateY(${liquidY(start)}px)`;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = liquid.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = `translateY(${liquidY(lv)}px)`; }));
    return () => cancelAnimationFrame(raf);
  }, [lv]);
  // decorative when there's no label (a number next to it already says it)
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' };
  return (
    <svg className="piggy" viewBox="0 0 220 160" {...a11y}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <ellipse cx="104" cy="86" rx="74" ry="52" />
          <rect x="166" y="66" width="28" height="34" rx="12" />
        </clipPath>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E8C76A" />
          <stop offset="1" stopColor="#B08A2E" />
        </linearGradient>
      </defs>
      <g className="piggy-legs">
        <rect x="54" y="122" width="16" height="26" rx="5" />
        <rect x="82" y="128" width="16" height="22" rx="5" />
        <rect x="118" y="128" width="16" height="22" rx="5" />
        <rect x="146" y="122" width="16" height="26" rx="5" />
      </g>
      <g clipPath={`url(#${id}-clip)`}>
        <rect className="piggy-bg" x="20" y="20" width="190" height="130" />
        <g ref={liquid} className="piggy-liquid">
          <path className="piggy-wave" fill={`url(#${id}-gold)`} d="M-40 6 Q -20 -4 0 6 T 40 6 T 80 6 T 120 6 T 160 6 T 200 6 T 240 6 T 280 6 V 160 H -40 Z" />
        </g>
      </g>
      <ellipse className="piggy-line" cx="104" cy="86" rx="74" ry="52" />
      <rect className="piggy-line" x="166" y="66" width="28" height="34" rx="12" />
      <circle className="piggy-nostril" cx="177" cy="83" r="2.6" />
      <circle className="piggy-nostril" cx="185" cy="83" r="2.6" />
      <circle className="piggy-eye" cx="150" cy="70" r="3.4" />
      <path className="piggy-line" d="M132 40 L146 18 L156 44" />
      <path className="piggy-line piggy-tail" d="M31 82 C 18 78, 16 96, 26 94 C 34 92, 28 84, 22 88" />
      <rect className="piggy-slot" x="88" y="34" width="34" height="7" rx="3.5" />
    </svg>
  );
}

// The piggy with its tail on fire — the daily streak reward
export function FlamingPiggy({ streak }) {
  return (
    <div className="fire-piggy">
      <Piggy level={Math.min(1, 0.15 + streak * 0.05)} />
      <svg className="pig-flame" viewBox="0 0 40 60" aria-hidden="true">
        <path className="pf-out" d="M20 2c2 10-6 14-9 22-3 7-1 16 4 21 3 3 7 5 10 5 9 0 14-8 13-17-1-7-5-11-8-15 0 5-2 8-5 10 1-9-1-17-5-26z" />
        <path className="pf-in" d="M21 30c-1 5-6 7-6 13 0 4 3 7 6 7 4 0 7-3 7-7 0-5-3-7-4-10-1 2-2 3-3 4 0-3 0-5 0-7z" />
      </svg>
    </div>
  );
}
