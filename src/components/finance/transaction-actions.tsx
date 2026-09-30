"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EllipsisVertical, Info, Pencil, Trash2, type LucideIcon } from "lucide-react";

export function TransactionActions({ description, onDetails, onEdit, onDelete }: { description: string; onDetails: () => void; onEdit: () => void; onDelete: () => void }) {
  return <RowActions description={description} items={[
    { label: "Ver detalhes", icon: Info, onSelect: onDetails },
    { label: "Editar", icon: Pencil, onSelect: onEdit },
    { label: "Excluir", icon: Trash2, onSelect: onDelete, danger: true },
  ]} />;
}

export type RowAction = { label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean };
export function RowActions({ description, items }: { description: string; items: RowAction[] }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null);
    };
    const dismiss = () => setPosition(null);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [position]);
  function choose(action: () => void) {
    trigger.current?.focus();
    setPosition(null);
    action();
  }
  return <><button ref={trigger} type="button" className="icon-button" title="Mais ações" aria-label={`Mais ações de ${description}`} aria-haspopup="menu" aria-expanded={!!position} aria-controls={position ? id : undefined} onClick={(event) => {
    event.stopPropagation();
    if (position) { setPosition(null); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const height = items.length * 44 + 22;
    setPosition({ left: Math.max(8, Math.min(rect.right - 216, window.innerWidth - 224)), top: rect.bottom + height > window.innerHeight ? Math.max(8, rect.top - height) : rect.bottom + 6 });
  }}><EllipsisVertical size={18} /></button>{position && createPortal(<div ref={menu} id={id} role="menu" aria-label={`Ações de ${description}`} className="transaction-popover" style={position} onClick={(event) => event.stopPropagation()} onBlur={(event) => { if (event.relatedTarget !== trigger.current && !event.currentTarget.contains(event.relatedTarget)) setPosition(null); }} onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); trigger.current?.focus(); setPosition(null); }
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  }}>{items.map(({ label, icon: Icon, onSelect, danger }) => <button key={label} type="button" role="menuitem" className={danger ? "delete-action" : undefined} onClick={() => choose(onSelect)}><Icon size={16} />{label}</button>)}</div>, document.body)}</>;
}
