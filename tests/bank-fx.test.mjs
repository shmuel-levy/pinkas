import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../app/js/logic.js';
import * as S from '../app/js/store.js';
import * as I from '../app/js/invest.js';

const ILS = (n) => n * 100;

test('dollars convert to shekels by the rate', () => {
  assert.equal(L.usdToIls(ILS(1000), 3.2), ILS(3200));
  assert.equal(L.usdToIls(12345, 3.2032), Math.round(12345 * 3.2032));
  assert.ok(L.DEFAULT_USD_ILS > 2 && L.DEFAULT_USD_ILS < 5);
});

test('bank investments are their own asset in the investments group', () => {
  const t = L.ASSET_TYPES.find((a) => a.key === 'bankInvest');
  assert.equal(t.group, 'invest');
  assert.equal(t.fx, true);
  assert.deepEqual(L.groupTotals({ assets: { checking: ILS(5000), bankInvest: ILS(20000) } }), { liquid: ILS(5000), invest: ILS(20000), longterm: 0 });
  // only investment-type assets can be entered in dollars
  assert.ok(L.ASSET_TYPES.filter((a) => a.fx).every((a) => a.group === 'invest'));
});

test('banks list includes Otsar HaHayal and names resolve', () => {
  assert.equal(L.bankName('otsar'), 'אוצר החייל');
  assert.equal(L.bankName('nope'), '');
  assert.equal(new Set(L.BANKS.map((b) => b.id)).size, L.BANKS.length);
});

test('store keeps bank, rate and the dollar amounts of a check-in', () => {
  const s = S.defaultState();
  s.onboarded = true;
  s.settings.bank = 'otsar';
  s.settings.usdRate = { rate: 3.2032, date: '2026-11-13' };
  s.snapshots = [{ id: 'a', period: '2026-11', date: '2026-11-10', income: 0, assets: { stocks: ILS(32032) }, usd: { stocks: ILS(10000), checking: 999 }, usdRate: 3.2032 }];
  const back = S.importJSON(S.exportJSON(s));
  assert.equal(back.settings.bank, 'otsar');
  assert.deepEqual(back.settings.usdRate, { rate: 3.2032, date: '2026-11-13' });
  assert.deepEqual(back.snapshots[0].usd, { stocks: ILS(10000) }, 'checking is shekels-only, dropped');
  assert.equal(back.snapshots[0].assets.stocks, ILS(32032));
  const bad = S.normalize({ categories: [{ id: 'a', name: 'א' }], expenses: [], settings: { bank: 'fake', usdRate: { rate: 99, date: 'x' } } });
  assert.equal(bad.settings.bank, '');
  assert.equal(bad.settings.usdRate, null);
});

test('broker cost uses the live dollar rate when given', () => {
  const ps = I.BROKERS.find((b) => b.id === 'psagot');
  const prof = { market: 'us', monthly: ILS(500), lump: 0 };
  const a = I.yearlyCost(ps, { ...prof, usdIls: 3.2 });
  const b = I.yearlyCost(ps, { ...prof, usdIls: 4 });
  assert.equal(a.commissions, 12 * Math.round(6 * 3.2 * 100));
  assert.ok(b.total > a.total);
});

test('bank custody estimate and market examples', () => {
  assert.deepEqual(I.bankCustodyYearly(ILS(100000)), { low: ILS(400), high: ILS(600) });
  assert.ok(I.MARKET_EXAMPLES.us.items.some((x) => x.tag === 'SPY'));
  assert.ok(I.MARKET_EXAMPLES.ta.items.some((x) => /35/.test(x.tag)));
  assert.ok(I.GLOSSARY.length >= 6);
});
