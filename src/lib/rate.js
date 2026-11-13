// Daily USD→ILS rate: ECB reference rate via frankfurter.dev, with a second free source as backup.
// Only the rate is requested — no personal data leaves the device.
const SOURCES = [
  ['https://api.frankfurter.dev/v1/latest?base=USD&symbols=ILS', (j) => j?.rates?.ILS],
  ['https://open.er-api.com/v6/latest/USD', (j) => j?.rates?.ILS],
];

let inflight = null;
export function fetchUsdRate() {
  if (inflight) return inflight;
  inflight = (async () => {
    for (const [url, pick] of SOURCES) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        const rate = pick(await res.json());
        if (rate > 1 && rate < 10) return Math.round(rate * 10000) / 10000;
      } catch {}
    }
    return null;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
