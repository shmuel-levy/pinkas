// A short explanation for people who said they're just starting out. "הבנתי" hides it for good.
import { useDispatch, useSelector } from 'react-redux';
import { D } from '../store/dataSlice.js';

export const useIsBeginner = () => useSelector((s) => s.data.settings.level === 'beginner');

export function Tip({ id, title, children }) {
  const dispatch = useDispatch();
  const beginner = useIsBeginner();
  const seen = useSelector((s) => !!s.data.settings.tipsSeen?.[id]);
  if (!beginner || seen) return null;
  return (
    <aside className="tip-box" aria-label={title ? `הסבר: ${title}` : 'הסבר'}>
      <svg className="tip-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
      <div className="tip-body">
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
      <button type="button" className="link small" onClick={() => dispatch(D.markTipSeen(id))}>הבנתי</button>
    </aside>
  );
}
