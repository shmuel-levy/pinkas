// Ledger rows: one expense or one income, tap to edit.
import * as L from '../lib/logic.js';
import { useCatById, useMoney } from '../hooks/useApp.js';
import { useOverlay } from './UiProvider.jsx';
import { Dot, M } from './ui.jsx';
import { useActions } from '../hooks/useActions.jsx';
import { useSelector } from 'react-redux';

export const byNewest = (a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (b.createdAt || 0) - (a.createdAt || 0));

export function ExpenseRow({ e, t, showDate = false }) {
  const catById = useCatById();
  const money = useMoney();
  const { openAdd } = useOverlay();
  const act = useActions();
  const spreads = useSelector((st) => st.data.spreads);
  const c = catById(e.catId);
  // a share of a spread expense is edited through its item, so all shares stay equal
  const edit = () => {
    const sp = e.spreadId && spreads.find((x) => x.id === e.spreadId);
    if (sp) act.openSpread(sp);
    else openAdd({ expense: e });
  };
  const title = e.note || c?.name || 'הוצאה';
  return (
    <li>
      <button type="button" className="row-btn" onClick={edit}
        aria-label={`${title}, ${money(e.amount)}${c ? `, ${c.name}` : ''}. עריכה`}>
        <span className="row-main">
          <span className="row-title">{title}</span>
          <span className="row-sub">
            {c && <><Dot color={c.color} />{c.name}</>}
            {c && showDate && ' · '}
            {showDate && L.dayLabel(e.date, t)}
            {e.pay && ` · ${L.payLabel(e.pay)}`}
            {e.spreadId ? <> <span className="tag">פריסה</span></> : e.recurringId ? <> <span className="tag">קבועה</span></> : null}
          </span>
        </span>
        <span className="row-amt"><M a={e.amount} /></span>
      </button>
    </li>
  );
}

export function IncomeRow({ i, t, showDate = false }) {
  const money = useMoney();
  const { openAdd } = useOverlay();
  const title = i.note || i.source;
  return (
    <li>
      <button type="button" className="row-btn" onClick={() => openAdd({ income: i })} aria-label={`הכנסה: ${title}, ${money(i.amount)}. עריכה`}>
        <span className="row-main">
          <span className="row-title">{title}</span>
          <span className="row-sub"><span className="tag tag-in">הכנסה</span> {i.source}{showDate && ` · ${L.dayLabel(i.date, t)}`}</span>
        </span>
        <span className="row-amt pos"><M a={i.amount} signed /></span>
      </button>
    </li>
  );
}
