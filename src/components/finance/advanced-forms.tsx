"use client";
import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";
import { MoneyField } from "@/components/finance/money-field";
import { Field } from "@/components/ui/field";
import { Select, Feedback } from "./controls";
import { DateField } from "./date-field";
import { recurringSchema, transferSchema } from "@/lib/validations/advanced";
import { financialRequest, type AccountRecord, type CategoryRecord } from "@/lib/finance/client";
import { todayInBrazil } from "@/lib/finance/dates";

export type AdvancedRecord = {
  nextScheduledDate?: string | null;
  id: string; description: string; amount: string; notes: string | null;
  type: "INCOME" | "EXPENSE"; accountId: string; categoryId: string; account: { name: string }; category: { name: string };
  startDate: string; endDate: string | null; dayOfMonth: number; isActive: boolean; revision: number;
  sourceAccountId: string; destinationAccountId: string; sourceAccount: { name: string }; destinationAccount: { name: string }; transferDate: string; competenceDate: string;
};
type Props = { initial?: AdvancedRecord; accounts: AccountRecord[]; categories: CategoryRecord[]; busy: boolean; setBusy: (busy: boolean) => void; onSaved: () => void };
export function RecurringForm({ initial, accounts, categories, busy, setBusy, onSaved }: Props) {
  const [error, setError] = useState("");
  const { register, control, setValue, handleSubmit, formState: { errors } } = useForm<z.input<typeof recurringSchema>, unknown, z.output<typeof recurringSchema>>({ resolver: zodResolver(recurringSchema), defaultValues: {
    type: initial?.type ?? "EXPENSE", description: initial?.description ?? "", amount: initial?.amount ?? "", accountId: initial?.accountId ?? "", categoryId: initial?.categoryId ?? "", startDate: initial?.startDate ?? todayInBrazil(), endDate: initial?.endDate ?? null, dayOfMonth: initial?.dayOfMonth ?? 10, isActive: initial?.isActive ?? true, revision: initial?.revision ?? 0, notes: initial?.notes ?? null,
  } });
  const type = useWatch({ control, name: "type" });
  async function save(input: z.output<typeof recurringSchema>) {
    if (busy) return; setBusy(true); setError("");
    try { await financialRequest(`/api/recurring-transactions${initial ? `/${initial.id}` : ""}`, { method: initial ? "PUT" : "POST", body: JSON.stringify(input) }); onSaved(); }
    catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  return <form noValidate className="form-stack" onSubmit={handleSubmit(save)}><fieldset disabled={busy} className="form-stack form-fieldset"><Feedback error={error || Object.values(errors)[0]?.message} />
    <p className="report-note">{initial ? "Alterações valem apenas para competências ainda não geradas. Lançamentos existentes permanecem iguais." : "Serão geradas até três competências a partir do mês atual ou do início futuro. Depois, use Gerar competência. Para valores variáveis, prefira Repetir."}</p>
    <Select id="rec-type" label="Tipo" {...register("type")} onChange={(e) => { setValue("type", e.target.value as typeof type); setValue("categoryId", ""); }}><option value="EXPENSE">Despesa</option><option value="INCOME">Receita</option></Select>
    <Field id="rec-description" label="Descrição" {...register("description")} maxLength={200} autoFocus />
    <Controller control={control} name="amount" render={({ field }) => <MoneyField id="rec-amount" label="Valor mensal (R$)" {...field} onValueChange={field.onChange} error={errors.amount?.message} />} />
    <Select id="rec-account" label="Conta" {...register("accountId")}><option value="">Selecione uma conta</option>{accounts.filter((a) => a.isActive || a.id === initial?.accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
    <Select id="rec-category" label="Categoria" {...register("categoryId")}><option value="">Selecione uma categoria</option>{categories.filter((c) => c.type === type && (c.isActive || c.id === initial?.categoryId)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
    <Field id="rec-day" label="Dia do mês (1 a 31)" inputMode="numeric" {...register("dayOfMonth")} />
    <Controller control={control} name="startDate" render={({ field }) => <DateField id="rec-start" label="Início" name={field.name} defaultValue={field.value} onValueChange={field.onChange} />} />
    <Controller control={control} name="endDate" render={({ field }) => <DateField id="rec-end" label="Término (opcional)" name={field.name} defaultValue={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)} />} />
    <label className="checkbox-field"><input type="checkbox" {...register("isActive")} />Recorrência ativa</label>
    <div className="field"><label htmlFor="rec-notes">Observações</label><textarea id="rec-notes" {...register("notes")} maxLength={2000} rows={3} /></div>
    <button className="button primary" disabled={busy}><Save size={18} />{busy ? "Salvando…" : "Salvar recorrência"}</button>
  </fieldset></form>;
}
export function TransferForm({ initial, accounts, busy, setBusy, onSaved }: Props) {
  const [error, setError] = useState("");
  const today = todayInBrazil();
  const { register, control, handleSubmit, formState: { errors } } = useForm<z.input<typeof transferSchema>, unknown, z.output<typeof transferSchema>>({ resolver: zodResolver(transferSchema), defaultValues: { sourceAccountId: initial?.sourceAccountId ?? "", destinationAccountId: initial?.destinationAccountId ?? "", amount: initial?.amount ?? "", transferDate: initial?.transferDate ?? today, competenceDate: initial?.competenceDate ?? `${today.slice(0, 7)}-01`, description: initial?.description ?? "", notes: initial?.notes ?? null } });
  async function save(input: z.output<typeof transferSchema>) {
    if (busy) return; setBusy(true); setError("");
    try { await financialRequest(`/api/transfers${initial ? `/${initial.id}` : ""}`, { method: initial ? "PUT" : "POST", body: JSON.stringify(input) }); onSaved(); }
    catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  return <form noValidate className="form-stack" onSubmit={handleSubmit(save)}><fieldset disabled={busy} className="form-stack form-fieldset"><Feedback error={error || Object.values(errors)[0]?.message} />
    <p className="report-note">Movimentação entre contas. Não altera receitas, despesas nem o planejamento da renda.</p>
    {(["sourceAccountId", "destinationAccountId"] as const).map((name) => <Select key={name} id={`transfer-${name}`} label={name === "sourceAccountId" ? "De: conta de origem" : "Para: conta de destino"} {...register(name)}><option value="">Selecione uma conta</option>{accounts.filter((a) => a.isActive || a.id === initial?.[name]).map((a) => <option key={a.id} value={a.id}>{a.name}{!a.includeInTotalBalance ? " (fora do saldo geral)" : ""}</option>)}</Select>)}
    <Controller control={control} name="amount" render={({ field }) => <MoneyField id="transfer-amount" label="Valor (R$)" {...field} onValueChange={field.onChange} error={errors.amount?.message} />} />
    <Controller control={control} name="transferDate" render={({ field }) => <DateField id="transfer-date" name={field.name} label="Data" defaultValue={field.value} onValueChange={field.onChange} />} />
    <Controller control={control} name="competenceDate" render={({ field }) => <DateField id="transfer-competence" name={field.name} label="Competência" monthOnly defaultValue={field.value.slice(0, 7)} onValueChange={(v) => field.onChange(v ? `${v}-01` : "")} />} />
    <Field id="transfer-description" label="Descrição (opcional)" {...register("description")} maxLength={200} />
    <div className="field"><label htmlFor="transfer-notes">Observações</label><textarea id="transfer-notes" {...register("notes")} maxLength={2000} rows={3} /></div>
    <button className="button primary" disabled={busy}><Save size={18} />{busy ? "Salvando…" : "Salvar transferência"}</button>
  </fieldset></form>;
}

