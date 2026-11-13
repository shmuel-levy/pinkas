import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as L from '../lib/logic.js';

export const useData = () => useSelector((s) => s.data);
export const useUi = () => useSelector((s) => s.ui);
export const useSettings = () => useSelector((s) => s.data.settings);
export { useDispatch };

export const today = () => L.todayISO();

// money(agorot, opts) formatted with the user's currency sign
export function useMoney() {
  const cur = useSelector((s) => s.data.settings.currency);
  return useMemo(() => (a, opts) => L.formatMoney(a, cur, opts), [cur]);
}

export function useCatById() {
  const cats = useSelector((s) => s.data.categories);
  return useMemo(() => {
    const map = new Map(cats.map((c) => [c.id, c]));
    return (id) => map.get(id);
  }, [cats]);
}

export const daysWord = (n) => (n === 1 ? 'יום אחד' : n === 2 ? 'יומיים' : `${n} ימים`);
