"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Pause, Play, CalendarPlus, Undo2, X, SlidersHorizontal } from "lucide-react";
import { AdvancedList } from "./advanced-list";
import { Field } from "@/components/ui/field";
import { Modal, Feedback, Select } from "./controls";
import { DateField, months } from "./date-field";
import { RecurringForm, TransferForm, type AdvancedRecord } from "./advanced-forms";
import { financialRequest, currency, type AccountRecord, type CategoryRecord } from "@/lib/finance/client";
import { todayInBrazil, displayDate, displayCompetence } from "@/lib/finance/dates";
type Result = { data: AdvancedRecord[]; pagination: { total: number; page: number; limit: number } };

export function AdvancedManager({ kind }: { kind: "transfers" | "recurring-transactions" }) {
  const router = useRouter();
  const recurring = kind === "recurring-transactions", title = recurring ? "Recorrências" : "Transferências";
  const [result, setResult] = useState<Result>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]), [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [revision, setRevision] = useState(0), [page, setPage] = useState(1), [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [detail, setDetail] = useState<AdvancedRecord | null>(null), [editor, setEditor] = useState<AdvancedRecord | "new" | null>(null);
  const [dirty, setDirty] = useState(false), [discard, setDiscard] = useState(false);
  const [actionError, setActionError] = useState("");
  const [generation, setGeneration] = useState<{ message: string; transactionId: string | null; competenceDate: string } | null>(null);
  const [view, setView] = useState<"details" | "generate" | "confirm">("details");
  function details(row: AdvancedRecord, generate = false, confirmAction = false) {
    setDetail(row); setView(confirmAction ? "confirm" : generate ? "generate" : "details"); setGeneration(null); setActionError("");
  }
  function edit(row: AdvancedRecord) { setEditor(row); setDetail(null); setDirty(false); }
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([financialRequest<Result>(`/api/${kind}?${query}&page=${page}`, { signal: controller.signal }), financialRequest<{ data: AccountRecord[] }>("/api/accounts", { signal: controller.signal }), financialRequest<{ data: CategoryRecord[] }>("/api/categories", { signal: controller.signal })])
      .then(([r, a, c]) => { if (!controller.signal.aborted) { setResult(r); setAccounts(a.data); setCategories(c.data); setError(""); } })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, query, page, revision]);
  function refresh() { setLoading(true); setRevision((r) => r + 1); router.refresh(); }
  function close() { setEditor(null); setDirty(false); setDiscard(false); }
  function filter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const params = new URLSearchParams();
    for (const [key, value] of new FormData(e.currentTarget)) if (value) params.set(key, String(value));
    setQuery(params.toString()); setPage(1); refresh();
  }
  async function remove() {
    if (!detail || busy) return; setBusy(true); setActionError("");
    try { await financialRequest(`/api/${kind}/${detail.id}`, { method: "DELETE" }); setDetail(null); setView("details"); setMessage(recurring ? "Recorrência desativada. Histórico preservado." : "Transferência excluída. Saldos recalculados."); setPage(1); refresh(); }
    catch (e) { setActionError((e as Error).message); } finally { setBusy(false); }
  }
  async function activate() {
    if (!detail || busy) return; setBusy(true); setActionError("");
    const { type, description, amount, accountId, categoryId, notes, startDate, endDate, dayOfMonth, revision } = detail;
    try {
      await financialRequest(`/api/recurring-transactions/${detail.id}`, { method: "PUT", body: JSON.stringify({ type, description, amount, accountId, categoryId, notes, startDate, endDate, dayOfMonth, revision, isActive: true }) });
      setDetail(null); setView("details"); setMessage("Recorrência ativada. Use Gerar competência para criar os lançamentos desejados."); refresh();
    } catch (e) { setActionError((e as Error).message); } finally { setBusy(false); }
  }
  async function generate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!detail || busy) return;
    const competenceDate = `${new FormData(e.currentTarget).get("competenceDate")}-01`;
    setBusy(true); setActionError(""); setGeneration(null);
    try { const r = await financialRequest<{ data: { generated: boolean; message: string; transactionId: string | null; competenceDate: string } }>(`/api/recurring-transactions/${detail.id}/generate`, { method: "POST", body: JSON.stringify({ competenceDate }) }); setGeneration(r.data); if (r.data.generated) refresh(); }
    catch (e) { setActionError((e as Error).message); } finally { setBusy(false); }
  }
  const Form = recurring ? RecurringForm : TransferForm;
  return <><div className="page-heading"><div><span className="eyebrow">SEU NÚCLEO FINANCEIRO</span><h1>{title}</h1><p>{recurring ? "Regras mensais para valores previsíveis. Os lançamentos gerados aparecem em Transações." : "Movimente valores entre suas contas, respeitando a competência."}</p></div><button className="button primary" disabled={loading || !!error} onClick={() => { setDirty(false); setEditor("new"); }}><Plus size={18} />{recurring ? "Nova recorrência" : "Transferir"}</button></div>
    <nav className="transaction-tabs" aria-label="Movimentações"><Link href="/transacoes">Transações</Link><Link href="/recorrencias" aria-current={recurring ? "page" : undefined}>Recorrências</Link><Link href="/transferencias" aria-current={!recurring ? "page" : undefined}>Transferências</Link></nav>
    <Feedback error={error} message={message} />
    <section className="panel filters-panel">{!recurring && <div className="filter-toolbar"><button type="button" className="button secondary" aria-expanded={filtersOpen} aria-controls="transfer-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={18} />Filtros e busca</button><span>{new URLSearchParams(query).size} filtros aplicados</span></div>}<form id={recurring ? "recurring-filters" : "transfer-filters"} hidden={!recurring && !filtersOpen} noValidate onSubmit={filter} className="filters-grid">
      {!recurring && <><Select id="advanced-month" label="Mês" name="month"><option value="">Todos os meses</option>{months.map((month, i) => <option key={month} value={i + 1}>{month}</option>)}</Select><Field id="advanced-year" label="Ano" name="year" inputMode="numeric" maxLength={4} placeholder="Todos os anos" /></>}
      <Select id="advanced-account" label="Conta" name="accountId"><option value="">Todas</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select><Field id="advanced-search" label="Buscar descrição" name="search" maxLength={200} /><button className="button secondary" disabled={loading}>Aplicar filtros</button><button type="reset" className="button secondary" onClick={() => { setQuery(""); setPage(1); refresh(); }}><X size={18} />Limpar filtros</button>
    </form></section>
    {loading ? <p role="status">Carregando…</p> : error ? <button className="button secondary" onClick={refresh}>Tentar novamente</button> : !result?.data.length ? <section className="panel empty-state">Nenhum registro encontrado.</section> : <AdvancedList rows={result.data} recurring={recurring} onDetails={details} onEdit={edit} onGenerate={(row) => details(row, true)} onToggle={(row) => details(row, false, true)} onDelete={(row) => details(row, false, true)} />}
    {result && result.pagination.total > 0 && <nav className="pagination" aria-label="Paginação"><button className="button secondary" disabled={loading || page <= 1} onClick={() => { setPage(page - 1); setLoading(true); }}>Anterior</button><span>Página {page} de {Math.ceil(result.pagination.total / result.pagination.limit)}</span><button className="button secondary" disabled={loading || page * result.pagination.limit >= result.pagination.total} onClick={() => { setPage(page + 1); setLoading(true); }}>Próxima</button></nav>}
    {detail && <Modal key={view} drawer={view === "details"} title={view === "generate" ? "Gerar competência" : view === "confirm" ? recurring ? detail.isActive ? "Desativar recorrência?" : "Ativar recorrência?" : "Excluir transferência?" : recurring ? "Detalhes da recorrência" : "Detalhes da transferência"} busy={busy} onClose={() => setDetail(null)}><Feedback error={actionError} /><h3>{detail.description || "Transferência"}</h3><p>{currency(detail.amount)}</p>{view === "details" && <><dl className="transaction-details ledger-details">{(recurring ? [["Tipo", detail.type === "INCOME" ? "Receita" : "Despesa"], ["Conta", detail.account.name], ["Categoria", detail.category.name], ["Início", displayDate(detail.startDate)], ["Término", displayDate(detail.endDate)], ["Dia mensal", String(detail.dayOfMonth)], ["Status", detail.isActive ? "Ativa" : "Desativada"]] : [["Origem", detail.sourceAccount.name], ["Destino", detail.destinationAccount.name], ["Data", displayDate(detail.transferDate)], ["Competência", displayCompetence(detail.competenceDate)]]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{detail.notes && <p className="transaction-notes">{detail.notes}</p>}
      <div className="record-actions"><button className="button secondary" disabled={busy} onClick={() => edit(detail)}><Pencil size={18} />Editar</button>{recurring && detail.isActive && <button className="button secondary" disabled={busy} onClick={() => details(detail, true)}><CalendarPlus size={18} />Gerar competência</button>}<button className="button secondary" disabled={busy} onClick={() => details(detail, false, true)}>{recurring ? detail.isActive ? <Pause size={18} /> : <Play size={18} /> : <Trash2 size={18} />}{recurring ? detail.isActive ? "Desativar" : "Ativar" : "Excluir"}</button></div></>}
      {recurring && detail.isActive && view === "generate" && <form className="form-stack generation-form" noValidate onSubmit={generate}><DateField id="generate-month" name="competenceDate" label="Mês do lançamento" monthOnly defaultValue={(detail.nextScheduledDate ?? todayInBrazil()).slice(0, 7)} /><button className="button primary" disabled={busy}><CalendarPlus size={18} />{busy ? "Gerando…" : "Criar lançamento do mês"}</button><p className="report-note">Ao cadastrar a recorrência, alguns meses já são gerados. Os lançamentos ficam em Transações, na competência correspondente. Se o lançamento foi excluído, esta ação cria um novo lançamento pendente. Lançamentos existentes não são duplicados.</p><Feedback message={generation?.message} />{generation?.transactionId && <Link className="text-link" href={`/transacoes?year=${generation.competenceDate.slice(0, 4)}&month=${Number(generation.competenceDate.slice(5, 7))}`}>Ver lançamentos de {displayCompetence(generation.competenceDate)} →</Link>}</form>}
      {view === "confirm" && <div><p>{recurring ? detail.isActive ? "Desativar impede novas gerações e mantém todos os lançamentos existentes." : "Ativar permite novas gerações e preserva os lançamentos existentes." : "Excluir esta transferência recalcula os saldos das duas contas."}</p><div className="record-actions"><button className="button secondary" disabled={busy} onClick={() => setDetail(null)}>Cancelar</button><button className="button danger" disabled={busy} onClick={recurring && !detail.isActive ? activate : remove}>Confirmar {recurring ? detail.isActive ? "desativação" : "ativação" : "exclusão"}</button></div></div>}
    </Modal>}
    {editor && <Modal drawer title={`${editor === "new" ? "Nova" : "Editar"} ${recurring ? "recorrência" : "transferência"}`} busy={busy} onClose={() => dirty ? setDiscard(true) : close()}><div onChange={() => setDirty(true)}><Form initial={editor === "new" ? undefined : editor} accounts={accounts} categories={categories} busy={busy} setBusy={setBusy} onSaved={() => { close(); setMessage("Registro salvo com sucesso."); refresh(); }} /></div></Modal>}
    {discard && <Modal title="Descartar alterações?" onClose={() => setDiscard(false)}><p>As alterações ainda não foram salvas.</p><div className="record-actions"><button className="button secondary" onClick={() => setDiscard(false)}>Continuar editando</button><button className="button danger" onClick={close}><Undo2 size={18} />Descartar alterações</button></div></Modal>}
  </>;
}
