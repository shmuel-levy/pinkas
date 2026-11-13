// One sheet for every form in the app. A form is described as data:
// { title, intro, body, fields: [{ name, label, type, value, ... }], submit, onSubmit(vals) => error?, extra: [{ label, danger, run }] }
// Field types: text | date | money (optionally fx: ₪/$) | select | check | heading | note
import { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Sheet } from '../components/Sheet.jsx';
import { useOverlay } from '../components/UiProvider.jsx';
import { useMoney } from '../hooks/useApp.js';
import * as L from '../lib/logic.js';

// a label can depend on other answers (e.g. the bank's name in the check-in)
const labelOf = (f, vals) => (typeof f.label === 'function' ? f.label(vals) : f.label);

const initial = (f) => {
  if (f.type === 'check') return !!f.value;
  if (f.type === 'money') {
    const usd = f.fx && f.cur === 'USD';
    const v = usd ? f.usdValue : f.value;
    return v ? String(v / 100) : '';
  }
  return f.value ?? '';
};

function FormBody({ cfg, close }) {
  const money = useMoney();
  const currency = useSelector((s) => s.data.settings.currency);
  const usdRateObj = useSelector((s) => s.data.settings.usdRate);
  const rate = usdRateObj?.rate || L.DEFAULT_USD_ILS;
  const fields = cfg.fields;
  const [vals, setVals] = useState(() => Object.fromEntries(fields.filter((f) => f.name).map((f) => [f.name, initial(f)])));
  const [curs, setCurs] = useState(() => Object.fromEntries(fields.filter((f) => f.fx).map((f) => [f.name, f.cur === 'USD' ? 'USD' : 'ILS'])));
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(null);
  const refs = useRef({});
  const set = (name, v) => setVals((x) => ({ ...x, [name]: v }));
  const fxHint = (name) => {
    const a = vals[name] ? L.parseAmount(vals[name]) : 0;
    if (!a) return '';
    return `≈ ${money(L.usdToIls(a, rate), { round: true })} · שער ${rate.toFixed(3)}${usdRateObj ? ` (${usdRateObj.date.slice(8)}/${Number(usdRateObj.date.slice(5, 7))})` : ' (משוער)'}`;
  };
  const switchCur = (name, to) => {
    if (curs[name] === to) return;
    const a = vals[name] ? L.parseAmount(vals[name]) : 0;
    if (a) {
      const conv = to === 'USD' ? Math.round(a / rate) : L.usdToIls(a, rate);
      set(name, (conv / 100).toFixed(2).replace(/\.00$/, ''));
    }
    setCurs((c) => ({ ...c, [name]: to }));
    refs.current[name]?.focus();
  };
  const fail = (msg, name) => {
    setError(msg);
    setInvalid(name || null);
    if (name) refs.current[name]?.focus();
  };

  const submit = (e) => {
    e.preventDefault();
    const out = {};
    for (const f of fields) {
      if (!f.name) continue;
      const label = `״${labelOf(f, vals).replace(/[?:]$/, '')}״`;
      if (f.type === 'check') out[f.name] = vals[f.name];
      else if (f.type === 'money') {
        const raw = String(vals[f.name]).trim();
        const a = raw ? L.parseAmount(raw) : 0;
        if (a === null) return fail(`${label} צריך להיות מספר, למשל 45 או 12.50`, f.name);
        if (f.required && !a) return fail(`חסר סכום ב${label}`, f.name);
        if (curs[f.name] === 'USD') {
          out[`${f.name}__usd`] = a;
          out[f.name] = L.usdToIls(a, rate);
        } else out[f.name] = a;
      } else {
        out[f.name] = String(vals[f.name]).trim();
        if (f.required && !out[f.name]) return fail(`צריך למלא את ${label}`, f.name);
      }
    }
    const r = cfg.onSubmit(out, rate);
    if (typeof r === 'string') return fail(r);
    close();
  };

  const field = (f, i) => {
    if (f.type === 'heading') return <h3 className="form-heading" key={i}>{f.label}</h3>;
    if (f.type === 'note') return <p className="form-note" key={i}>{f.label}</p>;
    const id = `f-${f.name}`;
    const common = {
      id,
      ref: (el) => { refs.current[f.name] = el; },
      'aria-invalid': invalid === f.name ? 'true' : undefined,
      'aria-describedby': f.hint ? `${id}-h` : undefined,
    };
    const hint = f.hint ? <span className="hint" id={`${id}-h`}>{typeof f.hint === 'function' ? f.hint(vals) : f.hint}</span> : null;
    if (f.type === 'check') {
      return (
        <label className="form-check" key={f.name}>
          <input type="checkbox" {...common} checked={vals[f.name]} onChange={(e) => set(f.name, e.target.checked)} /> {labelOf(f, vals)}
        </label>
      );
    }
    if (f.type === 'select') {
      return (
        <div className="form-field" key={f.name}>
          <label htmlFor={id}>{labelOf(f, vals)}</label>
          <select className="field" {...common} value={vals[f.name]} onChange={(e) => set(f.name, e.target.value)}>
            {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {hint}
        </div>
      );
    }
    if (f.type === 'money') {
      const usd = curs[f.name] === 'USD';
      const label = labelOf(f, vals);
      return (
        <div className="form-field" key={f.name}>
          <label htmlFor={id}>{label}</label>
          <div className={f.fx ? 'fx-row' : ''}>
            <div className="money-field">
              <input className="field" inputMode="decimal" autoComplete="off" {...common}
                aria-describedby={[f.fx && `${id}-fx`, f.hint && `${id}-h`].filter(Boolean).join(' ') || undefined}
                value={vals[f.name]} placeholder={f.placeholder || ''} onChange={(e) => set(f.name, e.target.value)} />
              <span className="cur" aria-hidden="true">{usd ? '$' : currency}</span>
            </div>
            {f.fx && (
              <div className="fx-toggle" role="group" aria-label={`מטבע: ${label}`}>
                <button type="button" aria-pressed={!usd} onClick={() => switchCur(f.name, 'ILS')}>₪</button>
                <button type="button" aria-pressed={usd} onClick={() => switchCur(f.name, 'USD')}>$</button>
              </div>
            )}
          </div>
          {f.fx && <span className="hint fx-hint" id={`${id}-fx`} aria-live="polite">{usd ? fxHint(f.name) : ''}</span>}
          {hint}
        </div>
      );
    }
    return (
      <div className="form-field" key={f.name}>
        <label htmlFor={id}>{labelOf(f, vals)}</label>
        <input className="field" type={f.type || 'text'} maxLength={f.max || 60} autoComplete="off" {...common}
          value={vals[f.name]} placeholder={f.placeholder || ''} onChange={(e) => set(f.name, e.target.value)} />
        {hint}
      </div>
    );
  };

  return (
    <form className="sheet-body" onSubmit={submit} noValidate>
      <div className="sheet-head">
        <h2 id="form-title">{cfg.title}</h2>
        <button type="button" className="link" data-close>ביטול</button>
      </div>
      {cfg.intro && <p className="form-intro">{cfg.intro}</p>}
      {cfg.body}
      {fields.map(field)}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="sheet-actions">
        <button type="submit" className="btn btn-primary">{cfg.submit}</button>
        {(cfg.extra || []).map((x, i) => (
          <button key={i} type="button" className={`btn ${x.danger ? 'btn-danger-quiet' : 'btn-line'}`}
            onClick={() => { if (x.run() !== false) close(); }}>{x.label}</button>
        ))}
      </div>
    </form>
  );
}

export function FormSheet() {
  const { form, closeForm } = useOverlay();
  const cfg = useMemo(() => form, [form]);
  return (
    <Sheet open={!!cfg} onClose={() => { cfg?.onClose?.(); closeForm(); }} labelledBy="form-title">
      {cfg && <FormBody key={cfg.key} cfg={cfg} close={() => { cfg.onClose?.(); closeForm(); }} />}
    </Sheet>
  );
}
