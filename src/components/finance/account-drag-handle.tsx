"use client";

import { useRef, useState, type PointerEvent } from "react";
import { GripVertical } from "lucide-react";
import styles from "./account-drag-handle.module.css";

export function AccountDragHandle({ id, name, disabled, onMove, onStep }: {
  id: string; name: string; disabled: boolean;
  onMove: (id: string, target: string) => void;
  onStep: (id: string, direction: number) => void;
}) {
  const pointer = useRef<number | null>(null);
  const target = useRef<HTMLElement | null>(null);
  const [dragging, setDragging] = useState(false);
  function clear() {
    target.current?.classList.remove(styles.target);
    target.current = null;
    pointer.current = null;
    setDragging(false);
  }
  function locate(event: PointerEvent<HTMLButtonElement>) {
    const grid = event.currentTarget.closest(".finance-grid");
    const card = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-account-id]") ?? null;
    target.current?.classList.remove(styles.target);
    target.current = card && grid?.contains(card) && card.dataset.accountId !== id ? card : null;
    target.current?.classList.add(styles.target);
  }
  return <button type="button" className={`icon-button secondary ${styles.handle}`} disabled={disabled}
    aria-label={`Mover ${name}. Arraste ou use as teclas de seta.`} title="Arraste para ordenar" aria-pressed={dragging}
    onPointerDown={event => {
      if (disabled || !event.isPrimary || event.button !== 0) return;
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }}
    onPointerMove={event => {
      if (pointer.current !== event.pointerId) return;
      if (event.clientY < 70) window.scrollBy(0, -18);
      else if (event.clientY > window.innerHeight - 70) window.scrollBy(0, 18);
      locate(event);
    }}
    onPointerUp={event => {
      if (pointer.current !== event.pointerId) return;
      locate(event);
      const targetId = target.current?.dataset.accountId;
      clear();
      if (targetId) onMove(id, targetId);
    }}
    onPointerCancel={clear} onLostPointerCapture={clear}
    onKeyDown={event => {
      if (event.key === "Escape") { clear(); return; }
      if (pointer.current !== null || disabled) return;
      if (["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        onStep(id, ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1);
      }
    }}><GripVertical size={18} /></button>;
}
