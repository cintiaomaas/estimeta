"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { SlidersHorizontal, X, Undo2 } from "lucide-react";
import { months } from "./date-field";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Modal, Select, Feedback } from "./controls";
import { TransactionList } from "./transaction-list";
import dynamic from "next/dynamic";
import { useTransactionCatalogs } from "./catalog-provider";
import { statusLabels, financialRequest, type TransactionRecord } from "@/lib/finance/client";
import { todayInBrazil } from "@/lib/finance/dates";
type Result = { data: TransactionRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
const TransactionForm = dynamic(() => import("./transaction-form").then(module => module.TransactionForm), {
  loading: () => <p role="status">Carregando formulário…</p>,
});

export function TransactionsManager({ fixedType, openNew, initialPeriod, selectedId }: { fixedType?: "INCOME" | "EXPENSE"; openNew?: "INCOME" | "EXPENSE"; initialPeriod?: string; selectedId?: string }) {
  const router = useRouter();
  const today = initialPeriod ?? todayInBrazil();
  const title = fixedType === "INCOME" ? "Receitas" : fixedType === "EXPENSE" ? "Despesas" : "Transações";
  const [query, setQuery] = useState(() => new URLSearchParams({ year: today.slice(0, 4), month: String(Number(today.slice(5, 7))), ...(fixedType ? { type: fixedType } : {}) }).toString());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterKey, setFilterKey] = useState(0);
  const [filterType, setFilterType] = useState(fixedType ?? "");
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const { accounts, categories, loading: catalogsLoading, error: catalogsError, retry: retryCatalogs } = useTransactionCatalogs();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState<TransactionRecord | "new" | null>(openNew ? "new" : null);
  const [repeating, setRepeating] = useState(false);
  const [deleting, setDeleting] = useState<TransactionRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  function closeEditor() {
    setEditor(null); setRepeating(false); setDirty(false); setDiscarding(false);
    if (openNew) router.replace("/transacoes", { scroll: false });
  }
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const transactions = await financialRequest<Result>(`/api/transactions?${query}&page=${page}`, { signal: controller.signal });
        if (!controller.signal.aborted) setResult(transactions);
      } catch (error) { if (!controller.signal.aborted) setError((error as Error).message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [query, page, revision]);
  // The same page can be reached through the mobile Add menu with new search params.
  useEffect(() => {
    if (openNew) {
      const timer = setTimeout(() => setEditor("new"), 0);
      return () => clearTimeout(timer);
    }
  }, [openNew]);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) if (String(value) && !(key === "sort" && value === "date") && !(key === "order" && value === "desc")) params.set(key, String(value));
    if (fixedType) params.set("type", fixedType);
    setPage(1); setQuery(params.toString()); setFiltersOpen(false);
  }
  function clearFilters() {
    setQuery(new URLSearchParams(fixedType ? { type: fixedType } : {}).toString());
    setPage(1);
    setFilterType(fixedType ?? "");
    setFilterKey((key) => key + 1);
    setMessage("Filtros limpos. Exibindo todos os períodos.");
    refresh();
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true); setDeleteError("");
    try {
      await financialRequest(`/api/transactions/${deleting.id}`, { method: "DELETE" });
      setDeleting(null); setMessage("Lançamento excluído com sucesso.");
      if (result?.data.length === 1 && page > 1) setPage(page - 1); else refresh();
    } catch (error) { setDeleteError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <><div className="page-heading"><div><span className="eyebrow">SEU NÚCLEO FINANCEIRO</span><h1>{title}</h1><p>Organize os lançamentos por competência e acompanhe o que está previsto ou realizado.</p></div><button className="button primary" onClick={() => { setRepeating(false); setDirty(false); setEditor("new"); }} disabled={loading || !!error}>Nova {fixedType === "INCOME" ? "receita" : fixedType === "EXPENSE" ? "despesa" : "transação"}</button></div>
    <Feedback error={error} message={message} />
    {catalogsError && <div role="alert">Não foi possível carregar contas e categorias. <button className="button secondary" onClick={retryCatalogs}>Tentar carregar opções</button></div>}
    <nav className="transaction-tabs" aria-label="Tipos de lançamento"><Link href="/transacoes" aria-current={!fixedType ? "page" : undefined}>Todos</Link><Link href="/receitas" aria-current={fixedType === "INCOME" ? "page" : undefined}>Receitas</Link><Link href="/despesas" aria-current={fixedType === "EXPENSE" ? "page" : undefined}>Despesas</Link><Link href="/recorrencias">Recorrências</Link><Link href="/transferencias">Transferências</Link></nav>
    <section className="panel filters-panel"><div className="filter-toolbar"><button type="button" className="button secondary" aria-expanded={filtersOpen} aria-controls="transaction-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={18} />Filtros e busca</button><span>Competência: {new URLSearchParams(query).get("month") ? `${months[Number(new URLSearchParams(query).get("month")) - 1]} / ` : "Todos os meses / "}{new URLSearchParams(query).get("year") ?? "Todos os anos"} · {Array.from(new URLSearchParams(query).keys()).filter((key) => !["year", "month", "type"].includes(key)).length} filtros adicionais</span><button type="button" className="button secondary" onClick={clearFilters}><X size={16} />Limpar filtros</button></div><form id="transaction-filters" key={filterKey} hidden={!filtersOpen} noValidate onSubmit={filter} className="filters-grid">
      <Select id="filter-month" label="Mês de competência" name="month" defaultValue={new URLSearchParams(query).get("month") ?? ""}><option value="">Todos os meses</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{months[index]}</option>)}</Select>
      <Field id="filter-year" label="Ano de competência" name="year" inputMode="numeric" maxLength={4} placeholder="Todos os anos" defaultValue={new URLSearchParams(query).get("year") ?? ""} />
      {!fixedType && <Select id="filter-type" label="Tipo" name="type" value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="">Todos</option><option value="INCOME">Receita</option><option value="EXPENSE">Despesa</option></Select>}
      <Select disabled={catalogsLoading || !!catalogsError} key={`category-${filterType}`} id="filter-category" label="Categoria" name="categoryId"><option value="">Todas</option>{categories.filter((row) => !filterType || row.type === filterType).map((row) => <option key={row.id} value={row.id}>{row.name} ({row.type === "INCOME" ? "receita" : "despesa"}){!row.isActive ? " — desativada" : ""}</option>)}</Select>
      <Select disabled={catalogsLoading || !!catalogsError} id="filter-account" label="Conta" name="accountId"><option value="">Todas</option>{accounts.map((row) => <option key={row.id} value={row.id}>{row.name}{!row.isActive ? " — desativada" : ""}</option>)}</Select>
      <Select key={`status-${filterType}`} id="filter-status" label="Status" name="status"><option value="">Todos</option>{Object.entries(statusLabels).filter(([value]) => filterType !== "INCOME" || !["PAID", "OVERDUE"].includes(value)).filter(([value]) => filterType !== "EXPENSE" || value !== "RECEIVED").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Field id="filter-search" label="Buscar por descrição" name="search" type="search" maxLength={200} placeholder="Ex.: internet" />
      <Select id="filter-sort" label="Ordenar por" name="sort"><option value="date">Data prevista</option><option value="amount">Valor</option><option value="description">Descrição</option></Select>
      <Select id="filter-order" label="Direção" name="order"><option value="desc">Decrescente</option><option value="asc">Crescente</option></Select>
      <button className="button primary" disabled={loading}>Aplicar filtros</button>
    </form></section>
    {loading ? <p role="status">Carregando lançamentos…</p> : error ? <button className="button secondary" onClick={refresh}>Tentar novamente</button> : result && !result.data.length ? <section className="panel empty-state"><h2>{fixedType === "INCOME" ? "Nenhuma receita encontrada." : fixedType === "EXPENSE" ? "Nenhuma despesa encontrada." : "Nenhuma transação neste período."}</h2><p>Ajuste os filtros ou adicione seu primeiro lançamento.</p></section> : <TransactionList selectedId={selectedId} onRepeat={(row) => { setRepeating(true); setDirty(false); setEditor(row); }} rows={result?.data ?? []} onEdit={(row) => { setRepeating(false); setDirty(false); setEditor(row); }} onDelete={(row) => { setDeleting(row); setDeleteError(""); }} />}
    {!loading && !error && result && result.pagination.total > 0 && <nav className="pagination" aria-label="Paginação"><button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page} de {result.pagination.totalPages} · {result.pagination.total}</span><button className="button secondary" disabled={page >= result.pagination.totalPages} onClick={() => setPage(page + 1)}>Próxima</button></nav>}
    {editor && !loading && !error && <Modal drawer title={repeating ? "Repetir lançamento" : editor === "new" ? "Novo lançamento" : "Editar lançamento"} busy={busy} onClose={() => dirty ? setDiscarding(true) : closeEditor()}>{catalogsLoading ? <p role="status">Carregando contas e categorias…</p> : catalogsError ? <div role="alert">{catalogsError}<button className="button secondary" onClick={retryCatalogs}>Tentar novamente</button></div> : <div onChange={() => setDirty(true)}><TransactionForm repeat={repeating} key={editor === "new" ? `new-${openNew ?? fixedType}` : `${editor.id}-${repeating}`} initial={editor === "new" ? undefined : editor} defaultType={openNew ?? fixedType} accounts={accounts} categories={categories} busy={busy} setBusy={setBusy} onSaved={async () => { setMessage(editor === "new" ? "Lançamento criado com sucesso." : "Lançamento atualizado com sucesso."); closeEditor(); refresh(); }} /></div>}</Modal>}
    {discarding && <Modal title="Descartar alterações?" onClose={() => setDiscarding(false)}><p>As alterações deste lançamento ainda não foram salvas.</p><div className="record-actions"><button className="button secondary" onClick={() => setDiscarding(false)}>Continuar editando</button><button className="button danger" onClick={closeEditor}><Undo2 size={18} />Descartar alterações</button></div></Modal>}
    {deleting && <Modal title="Excluir esta transação?" onClose={() => setDeleting(null)} busy={busy}><Feedback error={deleteError} /><p>{deleting.installmentPlanId ? `Excluir somente esta parcela (${deleting.installmentNumber}/${deleting.installmentCount}). As demais permanecem.` : `O lançamento “${deleting.description}” será removido permanentemente.`}</p><div className="record-actions"><button className="button secondary" onClick={() => setDeleting(null)} disabled={busy}>Cancelar</button><button className="button danger" onClick={remove} disabled={busy}>{busy ? "Excluindo…" : "Confirmar exclusão"}</button></div></Modal>}
  </>;
}



