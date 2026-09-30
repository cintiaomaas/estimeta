"use client";
import { FormActions } from "@/components/finance/form-actions";
import { useEffect, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MoneyField } from "@/components/finance/money-field";
import { Field } from "@/components/ui/field";
import { Select, Feedback } from "@/components/finance/controls";
import { DateField } from "@/components/finance/date-field";
import { goalSchema, contributionSchema, participantSchema } from "@/lib/validations/goals";
import { financialRequest, currency, type AccountRecord } from "@/lib/finance/client";
import { todayInBrazil, displayDate } from "@/lib/finance/dates";
import type { GoalRecord, GoalContributionRecord } from "@/services/goals";
type Common = { busy: boolean; setBusy: (v: boolean) => void; onDirty: (v: boolean) => void; onCancel: () => void; onSaved: () => void };
type Props = Common & { accounts: AccountRecord[] };
function ErrorText({ id, message }: { id: string; message?: string }) { return message ? <p id={id} className="field-error" role="alert">{message}</p> : null; }
export function GoalForm({ initial, accounts, busy, setBusy, onDirty, onSaved, onCancel }: Props & { initial?: GoalRecord }) {
  const [error, setError] = useState("");
  const { register, control, handleSubmit, formState: { errors, isDirty } } = useForm<z.input<typeof goalSchema>, unknown, z.output<typeof goalSchema>>({ resolver: zodResolver(goalSchema), defaultValues: { name: initial?.name ?? "", description: initial?.description ?? null, icon: (initial?.icon as z.input<typeof goalSchema>["icon"]) ?? null, targetAmount: initial?.targetAmount ?? "", startDate: initial?.startDate ?? todayInBrazil(), targetDate: initial?.targetDate ?? null, accountId: initial?.accountId ?? null, participants: [] } });
  useEffect(() => onDirty(isDirty), [isDirty, onDirty]);
  async function save(data: z.output<typeof goalSchema>) { if (busy) return; setBusy(true); setError(""); try { await financialRequest(`/api/goals${initial ? `/${initial.id}` : ""}`, { method: initial ? "PUT" : "POST", body: JSON.stringify(data) }); onSaved(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <form noValidate className="form-stack" onSubmit={handleSubmit(save)}><Feedback error={error} /><fieldset className="form-fieldset form-stack" disabled={busy}>
    <Field id="goal-name" label="Nome da meta *" maxLength={100} {...register("name")} error={errors.name?.message} autoFocus />
    <Controller control={control} name="targetAmount" render={({ field }) => <MoneyField id="goal-target" label="Valor-alvo (R$) *" {...field} onValueChange={field.onChange} error={errors.targetAmount?.message} />} />
    <div role="group" aria-describedby="goal-start-error"><Controller name="startDate" control={control} render={({ field }) => <DateField id="goal-start" label="Data de início *" name={field.name} defaultValue={field.value} onValueChange={field.onChange} />} /><ErrorText id="goal-start-error" message={errors.startDate?.message} /></div>
    <div role="group" aria-describedby="goal-end-error"><Controller name="targetDate" control={control} render={({ field }) => <DateField id="goal-end" label="Prazo (opcional)" name={field.name} defaultValue={field.value ?? ""} onValueChange={v => field.onChange(v || null)} />} /><ErrorText id="goal-end-error" message={errors.targetDate?.message} /></div>
    <Select id="goal-account" label="Conta associada (opcional)" {...register("accountId", { setValueAs: v => v || null })} aria-describedby="goal-account-error"><option value="">Sem conta associada</option>{accounts.filter(a => a.isActive || a.id === initial?.accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select><ErrorText id="goal-account-error" message={errors.accountId?.message} />
    <Select id="goal-icon" label="Ícone (opcional)" {...register("icon", { setValueAs: v => v || null })}><option value="">Sem ícone</option><option value="travel">Viagem</option><option value="home">Casa</option><option value="reserve">Reserva</option><option value="car">Carro</option><option value="study">Estudos</option></Select>
    <Field id="goal-description" label="Descrição (opcional)" {...register("description", { setValueAs: v => v || null })} maxLength={2000} error={errors.description?.message} />
    <p className="report-note">A conta é uma referência. O progresso será calculado pelas contribuições. Adicione os participantes nos detalhes da meta.</p><FormActions busy={busy} onCancel={onCancel} />
  </fieldset></form>;
}
type Transfer = { id: string; amount: string; transferDate: string; competenceDate: string; destinationAccountId: string; sourceAccount: { name: string }; destinationAccount: { name: string } };
export function ContributionForm({ goal, initial, accounts, busy, setBusy, onDirty, onSaved, onCancel }: Props & { goal: GoalRecord; initial?: GoalContributionRecord }) {
  const [error, setError] = useState(""), [search, setSearch] = useState("");
  const [page, setPage] = useState(1), [lookup, setLookup] = useState(false);
  const [transfers, setTransfers] = useState<{ data: Transfer[]; pagination: { total: number; limit: number } }>();
  const [lookupError, setLookupError] = useState("");
  const { register, control, setValue, handleSubmit, formState: { errors, isDirty } } = useForm<z.input<typeof contributionSchema>, unknown, z.output<typeof contributionSchema>>({ resolver: zodResolver(contributionSchema), defaultValues: { participantId: initial?.participantId ?? null, accountId: initial?.accountId ?? goal.accountId, transferId: initial?.transferId ?? null, amount: initial?.amount ?? "", contributionDate: initial?.contributionDate ?? todayInBrazil(), competenceDate: initial?.competenceDate ?? `${todayInBrazil().slice(0, 7)}-01`, description: initial?.description ?? null } });
  const transferId = useWatch({ control, name: "transferId" });
  useEffect(() => onDirty(isDirty), [isDirty, onDirty]);
  useEffect(() => { if (!lookup) return; const c = new AbortController(); financialRequest<typeof transfers>(`/api/transfers?search=${encodeURIComponent(search)}&page=${page}`, { signal: c.signal }).then(r => { setTransfers(r); setLookupError(""); }).catch(e => { if (!c.signal.aborted) setLookupError(e.message); }); return () => c.abort(); }, [lookup, search, page]);
  function link(t: Transfer) { for (const [key, value] of Object.entries({ transferId: t.id, amount: t.amount, accountId: t.destinationAccountId, contributionDate: t.transferDate, competenceDate: t.competenceDate })) setValue(key as "transferId" | "amount" | "accountId" | "contributionDate" | "competenceDate", value, { shouldDirty: true, shouldValidate: true }); setLookup(false); }
  async function save(data: z.output<typeof contributionSchema>) { if (busy) return; setBusy(true); setError(""); try { await financialRequest(`/api/goals/${goal.id}/contributions${initial ? `/${initial.id}` : ""}`, { method: initial ? "PUT" : "POST", body: JSON.stringify(data) }); onSaved(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <form noValidate className="form-stack" onSubmit={handleSubmit(save)}><Feedback error={error} /><fieldset disabled={busy} className="form-fieldset form-stack">
    <p className="report-note">Registrar uma contribuição não cria receita, despesa ou movimentação de saldo.</p>
    {transferId ? <div className="alert">Transferência vinculada. Valor, conta e datas vêm da movimentação existente.<button className="button secondary" type="button" onClick={() => setValue("transferId", null, { shouldDirty: true })}>Remover vínculo</button></div> : <button className="button secondary" type="button" onClick={() => setLookup(!lookup)}>Vincular transferência existente</button>}
    {lookup && <section className="goal-section"><Field id="transfer-search" label="Buscar transferência pela descrição" value={search} onChange={e => { setSearch(e.target.value); setPage(1); setTransfers(undefined); }} /><Feedback error={lookupError} />{!transfers ? <p role="status">Carregando transferências…</p> : <><ul className="goal-history">{transfers.data.map(t => <li key={t.id}><button className="button secondary" type="button" onClick={() => link(t)}>{t.sourceAccount.name} → {t.destinationAccount.name} · {currency(t.amount)} · {displayDate(t.transferDate)}</button></li>)}</ul>{!transfers.data.length && <p>Nenhuma transferência encontrada.</p>}<div className="record-actions"><button type="button" className="button secondary" disabled={page === 1} onClick={() => { setPage(page - 1); setTransfers(undefined); }}>Anterior</button><span>Página {page}</span><button type="button" className="button secondary" disabled={page * transfers.pagination.limit >= transfers.pagination.total} onClick={() => { setPage(page + 1); setTransfers(undefined); }}>Próxima</button></div></>}</section>}
    <Select id="contribution-participant" label="Participante (opcional)" {...register("participantId", { setValueAs: v => v || null })} aria-describedby="participant-error"><option value="">Sem participante</option>{goal.participants.filter(p => p.isActive || p.id === initial?.participantId).map(p => <option key={p.id} value={p.id}>{p.name}{p.isActive ? "" : " (inativo)"}</option>)}</Select><ErrorText id="participant-error" message={errors.participantId?.message} />
    <Controller control={control} name="amount" render={({ field }) => <MoneyField id="contribution-amount" label="Valor (R$) *" {...field} onValueChange={field.onChange} error={errors.amount?.message} readOnly={!!transferId} />} />
    <fieldset disabled={!!transferId} className="form-fieldset form-stack">
      <div role="group" aria-describedby="contribution-date-error"><Controller name="contributionDate" control={control} render={({ field }) => <DateField key={`date-${transferId ?? "manual"}`} id="contribution-date" name={field.name} label="Data *" defaultValue={field.value} onValueChange={field.onChange} />} /><ErrorText id="contribution-date-error" message={errors.contributionDate?.message} /></div>
      <div role="group" aria-describedby="contribution-month-error"><Controller name="competenceDate" control={control} render={({ field }) => <DateField key={`month-${transferId ?? "manual"}`} id="contribution-month" name={field.name} label="Competência *" monthOnly defaultValue={field.value.slice(0, 7)} onValueChange={v => field.onChange(`${v}-01`)} />} /><ErrorText id="contribution-month-error" message={errors.competenceDate?.message} /></div>
      <Select id="contribution-account" label="Conta (opcional)" {...register("accountId", { setValueAs: v => v || null })} aria-describedby="contribution-account-error"><option value="">Sem conta</option>{accounts.filter(a => a.isActive || a.id === initial?.accountId || !!transferId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select><ErrorText id="contribution-account-error" message={errors.accountId?.message} />
    </fieldset>
    <Field id="contribution-description" label="Descrição (opcional)" maxLength={2000} {...register("description", { setValueAs: v => v || null })} error={errors.description?.message} />
    <FormActions busy={busy} onCancel={onCancel} />
  </fieldset></form>;
}
export function ParticipantForm({ goal, initial, busy, setBusy, onDirty, onSaved, onCancel }: Common & { goal: GoalRecord; initial?: GoalRecord["participants"][number] }) {
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<z.input<typeof participantSchema>, unknown, z.output<typeof participantSchema>>({ resolver: zodResolver(participantSchema), defaultValues: { name: initial?.name ?? "", isActive: initial?.isActive ?? true } });
  useEffect(() => onDirty(isDirty), [isDirty, onDirty]);
  async function save(data: z.output<typeof participantSchema>) { if (busy) return; setBusy(true); setError(""); try { await financialRequest(`/api/goals/${goal.id}/participants${initial ? `/${initial.id}` : ""}`, { method: initial ? "PUT" : "POST", body: JSON.stringify(data) }); onSaved(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <form noValidate className="form-stack" onSubmit={handleSubmit(save)}><Feedback error={error} /><fieldset disabled={busy} className="form-fieldset form-stack"><Field id="participant-name" label="Nome *" autoFocus {...register("name")} error={errors.name?.message} /><label className="checkbox-field"><input type="checkbox" {...register("isActive")} />Participante ativo</label><p className="report-note">Não é necessário ter login. Desativar preserva todas as contribuições anteriores.</p><FormActions busy={busy} onCancel={onCancel} /></fieldset></form>;
}
