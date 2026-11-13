// A bottom sheet (or full-screen layer) on top of the native <dialog>: focus trap, Esc and backdrop for free.
import { useEffect, useRef } from 'react';

export function Sheet({ open, onClose, className = 'sheet', labelledBy, label, role, children, closeOnBackdrop = true }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    const handle = () => onCloseRef.current?.();
    d.addEventListener('close', handle);
    return () => d.removeEventListener('close', handle);
  }, []);

  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      aria-label={label}
      role={role}
      onClick={(e) => {
        e.stopPropagation(); // a sheet opened on top of another must not close the one below
        if (closeOnBackdrop && e.target === ref.current) ref.current.close();
        if (e.target.closest?.('[data-close]')) ref.current.close();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}
