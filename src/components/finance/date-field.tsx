"use client";
import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Select } from "./controls";
export const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export function DateField({ id, label, name, defaultValue = "", monthOnly = false, onValueChange }: { id: string; label: string; name: string; defaultValue?: string; monthOnly?: boolean; onValueChange?: (value: string) => void }) {
  const [year, setYear] = useState(defaultValue.slice(0, 4));
  const [month, setMonth] = useState(defaultValue.slice(5, 7));
  const [day, setDay] = useState(defaultValue.slice(8, 10));
  function change(part: "year" | "month" | "day", value: string) {
    const y = part === "year" ? value : year, m = part === "month" ? value : month, d = part === "day" ? value : day;
    if (part === "year") setYear(value); else if (part === "month") setMonth(value); else setDay(value);
    // A partially entered optional date must fail validation, not become null.
    onValueChange?.(y || m || (!monthOnly && d) ? `${y}-${m}${monthOnly ? "" : `-${d.padStart(2, "0")}`}` : "");
  }
  return <fieldset className="date-field"><legend>{label}</legend><div className="date-parts">{!monthOnly && <Field id={`${id}-day`} label="Dia" inputMode="numeric" maxLength={2} value={day} onChange={(e) => change("day", e.target.value.replace(/\D/g, ""))} />}<Select id={`${id}-month`} label="Mês" value={month} onChange={(e) => change("month", e.target.value)}><option value="">Selecione</option>{months.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}</Select><Field id={`${id}-year`} label="Ano" inputMode="numeric" maxLength={4} value={year} onChange={(e) => change("year", e.target.value.replace(/\D/g, ""))} /></div><input type="hidden" name={name} value={year && month && (monthOnly || day) ? `${year}-${month}${monthOnly ? "" : `-${day.padStart(2, "0")}`}` : ""} /></fieldset>;
}

