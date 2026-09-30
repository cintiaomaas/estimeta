"use client";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { planningSchema, type PlanningInput } from "@/lib/validations/planning";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/finance/form-actions";
import type { CategoryRecord } from "@/lib/finance/client";
type Group = PlanningInput["groups"][number];
export function GroupForm({ initial, categories, used, onDirty, onSave, onCancel }: { initial?: Group; categories: CategoryRecord[]; used: string[]; onDirty: (dirty: boolean) => void; onSave: (group: Group) => void; onCancel: () => void }) {
  const { register, control, handleSubmit, formState: { errors, isDirty } } = useForm<Group>({ resolver: zodResolver(planningSchema.shape.groups.element), defaultValues: initial ?? { name: "", percentage: "", alertPercentage: "90", active: true, categoryIds: [] } });
  useEffect(() => onDirty(isDirty), [isDirty, onDirty]);
  const active = useWatch({ control, name: "active" });
  return <form noValidate className="form-stack" onSubmit={handleSubmit(onSave)}><Field id="group-name" label="Nome" {...register("name")} error={errors.name?.message} autoFocus />
    <Field id="group-percentage" label="Percentual planejado (%)" inputMode="decimal" {...register("percentage", { setValueAs: v => v.trim().replace(",", ".") })} error={errors.percentage?.message} hint="30 representa 30% da renda." />
    <Field id="group-alert" label="Percentual de alerta (%)" inputMode="decimal" {...register("alertPercentage", { setValueAs: v => v.trim().replace(",", ".") })} error={errors.alertPercentage?.message} />
    <label className="checkbox-field"><input type="checkbox" {...register("active")} />Grupo ativo</label>
    <fieldset className="planning-categories"><legend>Categorias</legend>{categories.map(c => <label key={c.id} className="checkbox-field"><input type="checkbox" value={c.id} {...register("categoryIds")} disabled={active && used.includes(c.id) && !initial?.categoryIds.includes(c.id)} />{c.name}{!c.isActive ? " (desativada)" : ""}{active && used.includes(c.id) ? " — em outro grupo ativo" : ""}</label>)}</fieldset>
    <p className="report-note">As mudanças deste grupo serão aplicadas ao salvar o planejamento.</p><FormActions busy={false} onCancel={onCancel} />
  </form>;
}
