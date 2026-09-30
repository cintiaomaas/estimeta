"use client";
import { useEffect, useRef, useId, type ReactNode, type SelectHTMLAttributes } from "react";

export function Select({ label, id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string }) {
  return <div className="field"><label htmlFor={id}>{label}</label><select id={id} {...props}>{children}</select></div>;
}
export function Modal({ title, onClose, busy = false, children, drawer = false, dismissOutside = false }: { title: string; onClose: () => void; busy?: boolean; children: ReactNode; drawer?: boolean; dismissOutside?: boolean }) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const focused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; focused?.focus(); };
  }, []);
  return <dialog ref={ref} className={`finance-dialog${drawer ? " finance-drawer" : ""}`} aria-labelledby={titleId} onClick={(event) => { if (dismissOutside && !busy && event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="dialog-heading"><h2 id={titleId}>{title}</h2><button className="button secondary" type="button" onClick={onClose} disabled={busy} aria-label="Fechar">×</button></div>{children}
  </dialog>;
}
export function Feedback({ error, message }: { error?: string; message?: string }) {
  return <>{error && <div role="alert" className="alert error">{error}</div>}{message && <div role="status" className="alert">{message}</div>}</>;
}

