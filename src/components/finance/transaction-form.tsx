"use client";
import Link from "next/link";
import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";
import { MoneyField } from "@/components/finance/money-field";
import { Field } from "@/components/ui/field";
import { Select, Feedback } from "./controls";
import { financialRequest, type AccountRecord, type CategoryRecord, type TransactionRecord } from "@/lib/finance/client";
import { todayInBrazil } from "@/lib/finance/dates";
import { transactionSchema } from "@/lib/validations/finance";
import { installmentSchema } from "@/lib/validations/advanced";
import { DateField } from "./date-field";
import { addMonthsClamped } from "@/lib/finance/months";

export function TransactionForm({ initial, repeat = false, defaultType, accounts, categories, onSaved, busy, setBusy }: {
  initial?: TransactionRecord; repeat?: boolean; defaultType?: "INCOME" | "EXPENSE"; accounts: AccountRecord[]; categories: CategoryRecord[];
  onSaved: () => Promise<void>; busy: boolean; setBusy: (value: boolean) => void;
}) {
  const [mode, setMode] = useState("single");
  const [count, setCount] = useState("2");
  const [error, setError] = useState("");
  const today = todayInBrazil();
  const { register, control, setValue, handleSubmit, formState: { errors } } = useForm<z.input<typeof transactionSchema>, unknown, z.output<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { type: initial?.type ?? defaultType ?? "EXPENSE", status: repeat ? "PENDING" : (initial?.status as "PENDING" | "PAID" | "RECEIVED" ?? "PENDING"), description: initial?.description ?? "", amount: repeat ? "" : initial?.amount ?? "", accountId: initial?.accountId ?? "", categoryId: initial?.categoryId ?? "", notes: initial?.notes ?? null, transactionDate: repeat ? null : initial?.transactionDate ?? null, competenceDate: repeat && initial ? addMonthsClamped(initial.competenceDate, 1) : initial?.competenceDate ?? `${today.slice(0, 7)}-01`, scheduledDate: repeat && initial ? addMonthsClamped(initial.scheduledDate, 1) : initial?.scheduledDate ?? today },
  });
  const type = useWatch({ control, name: "type" }), status = useWatch({ control, name: "status" });
  const editing = !!initial && !repeat;
  const allowedAccounts = accounts.filter((row) => row.isActive || (editing && row.id === initial?.accountId));
  const allowedCategories = categories.filter((row) => row.type === type && (row.isActive || (editing && row.id === initial?.categoryId)));
  if (!allowedAccounts.length) return <div className="empty-state"><p>Cadastre uma conta para começar.</p><Link href="/contas" className="button primary">Cadastrar conta</Link></div>;
  async function submit(input: z.output<typeof transactionSchema>) {
    if (busy) return;
    const parcelled = !editing && type === "EXPENSE" && mode === "installments";
    const payload = parcelled ? { ...input, installmentCount: Number(count) } : input;
    if (parcelled) {
      const parsed = installmentSchema.safeParse(payload);
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    }
    setBusy(true); setError("");
    try {
      await financialRequest(parcelled ? "/api/installment-plans" : `/api/transactions${editing ? `/${initial!.id}` : ""}`, { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) });
      await onSaved();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  const date = (name: "competenceDate" | "scheduledDate" | "transactionDate", label: string, monthOnly = false) => <Controller name={name} control={control} render={({ field }) => <DateField id={`transaction-${name}`} name={name} label={label} monthOnly={monthOnly} defaultValue={monthOnly ? field.value?.slice(0, 7) : field.value ?? today} onValueChange={(value) => field.onChange(monthOnly && value ? `${value}-01` : value)} />} />;
  return <form className="form-stack" noValidate onSubmit={handleSubmit(submit)}><fieldset disabled={busy} className="form-stack form-fieldset"><Feedback error={error || Object.values(errors)[0]?.message} />
    {repeat && <p className="alert">Próxima competência sugerida. Informe e revise o valor antes de salvar. Nenhum lançamento foi criado ainda.</p>}
    {editing && initial?.installmentPlanId && <p className="alert">Parcela {initial.installmentNumber}/{initial.installmentCount}: alterar somente esta parcela.</p>}
    <Select id="transaction-type" label="Tipo" {...register("type")} disabled={editing && !!(initial?.installmentPlanId || initial?.recurringOccurrenceId)} onChange={(event) => { setValue("type", event.target.value as typeof type); setValue("categoryId", ""); setValue("status", "PENDING"); setValue("transactionDate", null); setMode("single"); }}><option value="INCOME">Receita</option><option value="EXPENSE">Despesa</option></Select>
    {!editing && type === "EXPENSE" && <Select id="transaction-mode" label="Pagamento" value={mode} onChange={(event) => { setMode(event.target.value); setValue("status", "PENDING"); setValue("transactionDate", null); }}><option value="single">À vista</option><option value="installments">Parcelada</option></Select>}
    <Field id="transaction-description" label="Descrição" {...register("description")} maxLength={200} autoFocus />
    <div className="form-grid"><Controller control={control} name="amount" render={({ field }) => <MoneyField id="transaction-amount" label={mode === "installments" ? "Valor total (R$)" : "Valor (R$)"} {...field} onValueChange={field.onChange} error={errors.amount?.message} />} />
    {mode === "installments" ? <Field id="installment-count" label="Quantidade de parcelas" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} /> : <Select id="transaction-status" label="Status" {...register("status")} onChange={(event) => { setValue("status", event.target.value as "PENDING" | "PAID" | "RECEIVED"); setValue("transactionDate", event.target.value === "PENDING" ? null : today); }}><option value="PENDING">Previsto</option><option value={type === "INCOME" ? "RECEIVED" : "PAID"}>{type === "INCOME" ? "Recebido" : "Pago"}</option></Select>}</div>
    <div className="form-grid"><Select id="transaction-account" label="Conta" {...register("accountId")}><option value="">Selecione a conta</option>{allowedAccounts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select>
    <Select id="transaction-category" label="Categoria" {...register("categoryId")}><option value="">Selecione a categoria</option>{allowedCategories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></div>
    {!allowedCategories.length && <Link href="/configuracoes/categorias">Cadastrar categoria</Link>}
    {date("competenceDate", mode === "installments" ? "Primeira competência" : "Competência", true)}
    {date("scheduledDate", mode === "installments" ? "Vencimento da primeira parcela" : "Vencimento / data prevista")}
    {status !== "PENDING" && date("transactionDate", "Data efetiva")}
    <p className="report-note">Competência define o mês do relatório. Vencimento define o atraso. {mode === "installments" && "Todas as parcelas começam pendentes. Os centavos excedentes ficam nas primeiras parcelas."}</p>
    <div className="field"><label htmlFor="transaction-notes">Observações (opcional)</label><textarea id="transaction-notes" {...register("notes")} rows={3} maxLength={2000} /></div>
    <button className="button primary" disabled={busy || !allowedCategories.length}><Save size={18} />{busy ? "Salvando…" : mode === "installments" ? "Criar parcelas" : "Salvar lançamento"}</button>
  </fieldset></form>;
}

