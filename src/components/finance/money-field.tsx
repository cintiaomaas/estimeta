"use client";
import { Field } from "@/components/ui/field";
import { useState, type Ref } from "react";
import { normalizeMoneyInput, displayMoneyInput } from "@/lib/finance/money-input";

export function MoneyField({ id, label, name, value, defaultValue = "", onValueChange, onBlur, hint, error, readOnly, disabled, ref }: {
  id: string; label: string; name?: string; value?: string; defaultValue?: string;
  onValueChange?: (value: string) => void; onBlur?: () => void; hint?: string; error?: string; readOnly?: boolean; disabled?: boolean; ref?: Ref<HTMLInputElement>;
}) {
  const initial = value ?? defaultValue;
  const [input, setInput] = useState({ source: initial, text: displayMoneyInput(initial) });
  const text = value !== undefined && value !== input.source ? displayMoneyInput(value) : input.text;
  function update(raw: string, blur = false) {
    const normalized = normalizeMoneyInput(raw);
    setInput({ source: normalized, text: blur ? displayMoneyInput(raw) : raw });
    onValueChange?.(normalized);
  }
  return <><Field ref={ref} id={id} label={label} inputMode="decimal" placeholder="0,00" value={text} hint={hint} error={error} readOnly={readOnly} disabled={disabled}
    onFocus={event => { if (!readOnly && normalizeMoneyInput(event.currentTarget.value) === "0.00") event.currentTarget.select(); }}
    onChange={event => update(event.target.value)} onBlur={event => { update(event.target.value, true); onBlur?.(); }} />
    {name && <input type="hidden" name={name} value={normalizeMoneyInput(text)} disabled={disabled} />}</>;
}
