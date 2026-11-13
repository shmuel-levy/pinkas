// Generates the banknote-style guilloché line pattern used as a mask in the "vault" panels.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'img');
mkdirSync(out, { recursive: true });

const W = 600, H = 300;
const f = (n) => n.toFixed(1);
const paths = [];

// rosette: overlapping phase-shifted petal curves
const cx = 110, cy = 150;
for (let j = 0; j < 16; j++) {
  const ph = (j / 16) * Math.PI * 2;
  let d = '';
  for (let i = 0; i <= 360; i++) {
    const t = (i / 360) * Math.PI * 2;
    const r = 78 + 20 * Math.sin(9 * t + ph) + 6 * Math.sin(3 * t - ph);
    d += `${i ? 'L' : 'M'}${f(cx + r * Math.cos(t))} ${f(cy + r * Math.sin(t))}`;
  }
  paths.push(d + 'Z');
}
// inner ring
for (let j = 0; j < 8; j++) {
  const ph = (j / 8) * Math.PI;
  let d = '';
  for (let i = 0; i <= 360; i++) {
    const t = (i / 360) * Math.PI * 2;
    const r = 34 + 8 * Math.sin(12 * t + ph);
    d += `${i ? 'L' : 'M'}${f(cx + r * Math.cos(t))} ${f(cy + r * Math.sin(t))}`;
  }
  paths.push(d + 'Z');
}
// flowing banknote waves across the panel
for (let k = 0; k < 14; k++) {
  const y0 = 14 + k * 21;
  let d = '';
  for (let x = 200; x <= W; x += 6) {
    const y = y0 + 7 * Math.sin(x / 26 + k * 0.55) + 3 * Math.sin(x / 9.5 - k);
    d += `${x === 200 ? 'M' : 'L'}${x} ${f(y)}`;
  }
  paths.push(d);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMid slice"><g fill="none" stroke="#000" stroke-width="0.7">${paths.map((d) => `<path d="${d}"/>`).join('')}</g></svg>`;
writeFileSync(join(out, 'guilloche.svg'), svg);
console.log('guilloche.svg', (svg.length / 1024).toFixed(1) + 'KB');
