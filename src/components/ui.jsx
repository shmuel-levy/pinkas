// Small presentational building blocks shared by every page.
import { useEffect, useRef } from 'react';
import { useMoney } from '../hooks/useApp.js';
import { countUp } from '../lib/fx.js';

// A money amount, isolated left-to-right inside Hebrew text
export function M({ a, round, signed, className = '' }) {
  const money = useMoney();
  return <span className={`num ${className}`}>{money(a, { round, signed })}</span>;
}

// A number that counts up from 0 when it first appears (animate=false shows it straight away)
export function CountUp({ a, className = '', duration = 900, animate = true }) {
  const money = useMoney();
  const ref = useRef(null);
  const shown = useRef(false);
  useEffect(() => {
    if (!ref.current) return;
    if (!shown.current && animate) {
      shown.current = true;
      countUp(ref.current, a, (v) => money(v, { round: true }), { duration });
    } else ref.current.textContent = money(a, { round: true });
  }, [a, money, duration]);
  return <span ref={ref} className={`num ${className}`}>{money(a, { round: true })}</span>;
}

// Budget bar with the "where you should be today" tick
export function Bar({ st, pace = true }) {
  if (!st.hasBudget) return null;
  const pct = Math.min(100, (st.ratio || 0) * 100);
  const cls = st.state === 'over' ? 'is-over' : st.state === 'warn' ? 'is-warn' : '';
  return (
    <div className={`bar ${cls}`} role="img" aria-label={`נוצלו ${Math.round((st.ratio || 0) * 100)} אחוז מהתקציב${st.current ? `, עברו ${Math.round(st.pace * 100)} אחוז מהחודש` : ''}`}>
      <span className="bar-fill" style={{ width: `${pct.toFixed(1)}%` }} />
      {pace && st.current && <span className="bar-pace" style={{ insetInlineStart: `${(st.pace * 100).toFixed(1)}%` }} title="איפה כדאי להיות היום" />}
    </div>
  );
}

export function Dot({ color }) {
  return <i className="dot" style={{ background: color }} aria-hidden="true" />;
}

// Trend line, oldest on the right (RTL)
export function Sparkline({ values, label, w = 300, h = 54 }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [w - (i / (values.length - 1)) * w, h - 6 - ((v - min) / span) * (h - 12)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="3.5" className="spark-dot" />
    </svg>
  );
}
