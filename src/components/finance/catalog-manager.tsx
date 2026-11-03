"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { accountSchema, categorySchema } from "@/lib/validations/finance";
import { Field } from "@/components/ui/field";
import { Select, Modal, Feedback } from "./controls";
import { BankIdentity, BankSelect } from "./bank-identity";
import { AccountDragHandle } from "./account-drag-handle";
import { MoneyField } from "./money-field";
import { AccountBalance } from "./account-balance";
import { currencyLabels } from "@/lib/finance/currencies";
import { accountLabels, financialRequest, moneyInput, type AccountRecord, type CategoryRecord } from "@/lib/finance/client";
type RecordItem = AccountRecord | CategoryRecord;

export function CatalogManager({ kind }: { kind: "accounts" | "categories" }) {
  const isAccount = kind === "accounts";
  const title = isAccount ? "Contas" : "Categorias";
  const [rows, setRows] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState<RecordItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<RecordItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [accountCurrency, setAccountCurrency] = useState("BRL");
  const [refreshingRates, setRefreshingRates] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState("");
  async function moveAccount(id: string, targetId: string) {
    if (ordering || busy || editor || deleting) return;
    const from = rows.findIndex(row => row.id === id);
    const to = rows.findIndex(row => row.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const previous = rows;
    const next = [...rows];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setRows(next); setOrdering(true); setOrderError(""); setMessage("");
    try {
      await financialRequest("/api/accounts/order", { method: "PUT", body: JSON.stringify({ ids: next.map(row => row.id) }) });
      setMessage("Ordem das contas salva.");
    } catch (error) {
      setRows(previous);
      setOrderError(`Não foi possível salvar a ordem. ${(error as Error).message}`);
    } finally { setOrdering(false); }
  }
  const load = useCallback(async () => {
    try { setRows((await financialRequest<{ data: RecordItem[] }>(`/api/${kind}`)).data); setError(""); }
    catch (error) { setError((error as Error).message); }
    finally { setLoading(false); }
  }, [kind]);
  useEffect(() => {
    const controller = new AbortController();
    financialRequest<{ data: RecordItem[] }>(`/api/${kind}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setRows(result.data); setError(""); } })
      .catch((error: Error) => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind]);
  useEffect(() => {
    if (!isAccount) return;
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); };
  }, [isAccount, load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    const input = { name: form.get("name"), type: form.get("type"), isActive: form.get("isActive") === "on", ...(isAccount ? { currency: form.get("currency"), bankCode: form.get("bankCode") || null, initialBalance: moneyInput(String(form.get("initialBalance"))), includeInTotalBalance: form.get("includeInTotalBalance") === "on" } : {}) };
    setBusy(true); setFormError("");
    try {
      const parsed = (isAccount ? accountSchema : categorySchema).safeParse(input);
      if (!parsed.success) { setFormError(parsed.error.issues[0].message); return; }
      await financialRequest(`/api/${kind}${editor && editor !== "new" ? `/${editor.id}` : ""}`, { method: editor === "new" ? "POST" : "PUT", body: JSON.stringify(input) });
      setEditor(null); setMessage("Registro salvo com sucesso."); await load();
    } catch (error) { setFormError((error as Error).message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true); setFormError("");
    try {
      const result = await financialRequest<{ data: { message: string } }>(`/api/${kind}/${deleting.id}`, { method: "DELETE" });
      setDeleting(null); setMessage(result.data.message); await load();
    } catch (error) { setFormError((error as Error).message); }
    finally { setBusy(false); }
  }
  function renderRows(items: RecordItem[]) {
    return <div className="finance-grid">{items.map((row) => <article key={row.id} data-account-id={isAccount ? row.id : undefined} className="panel finance-card"><div className="record-heading"><div>{"initialBalance" in row && <BankIdentity bankCode={row.bankCode} />}<h2>{row.name}</h2></div><span className="status-chip">{row.isActive ? "Ativa" : "Desativada"}</span></div>
      {"initialBalance" in row ? <><p>{accountLabels[row.type]}</p><AccountBalance account={row} /></> : <p>{row.type === "INCOME" ? "Receita" : "Despesa"}</p>}
      <div className="record-actions">{isAccount && rows.length > 1 && <AccountDragHandle id={row.id} name={row.name} disabled={ordering || busy || !!editor || !!deleting} onMove={moveAccount} onStep={(id, direction) => { const target = rows[rows.findIndex(row => row.id === id) + direction]; if (target) void moveAccount(id, target.id); }} />}<button disabled={ordering} title="Editar" className="icon-button secondary" onClick={() => { setAccountCurrency("initialBalance" in row ? row.currency ?? "BRL" : "BRL"); setEditor(row); setFormError(""); }} aria-label={`Editar ${row.name}`}><Pencil size={18} /></button><button disabled={ordering} title="Excluir" className="icon-button danger" onClick={() => { setDeleting(row); setFormError(""); }} aria-label={`Excluir ${row.name}`}><Trash2 size={18} /></button></div></article>)}</div>;
  }
  return <><div className="page-heading"><div><span className="eyebrow">SEU NÚCLEO FINANCEIRO</span><h1>{title}</h1><p>{isAccount ? "Cadastre onde seu dinheiro é movimentado e informe o saldo inicial de cada conta." : "Personalize as categorias de receitas e despesas do seu espaço familiar."}</p></div><button className="button primary" disabled={ordering} onClick={() => { setAccountCurrency("BRL"); setEditor("new"); setFormError(""); }}>Adicionar {isAccount ? "conta" : "categoria"}</button></div>
    {isAccount && rows.some(row => "initialBalance" in row && row.currency && row.currency !== "BRL") && <button className="button secondary" disabled={refreshingRates || busy} onClick={async () => {
      setRefreshingRates(true);
      try { const result = await financialRequest<{ data: { message: string } }>("/api/exchange-rates", { method: "POST" }); setMessage(result.data.message); await load(); }
      catch (error) { setError((error as Error).message); } finally { setRefreshingRates(false); }
    }}>{refreshingRates ? "Atualizando cotações…" : "Atualizar cotações"}</button>}
    <Feedback error={error || orderError} message={message} />
    {loading ? <p role="status">Carregando {title.toLowerCase()}…</p> : error ? <button className="button secondary" onClick={load}>Tentar novamente</button> : !rows.length ? <section className="panel empty-state"><h2>{isAccount ? "Nenhuma conta cadastrada." : "Nenhuma categoria cadastrada."}</h2><p>Use o botão Adicionar para começar.</p></section> : isAccount ? renderRows(rows) : <>{["INCOME", "EXPENSE"].map((type) => <section key={type} className="catalog-section"><h2>Categorias de {type === "INCOME" ? "receita" : "despesa"}</h2>{rows.some((row) => row.type === type) ? renderRows(rows.filter((row) => row.type === type)) : <p>Nenhuma categoria deste tipo. Adicione uma para começar.</p>}</section>)}</>}
    {editor && <Modal title={`${editor === "new" ? "Nova" : "Editar"} ${isAccount ? "conta" : "categoria"}`} onClose={() => setEditor(null)} busy={busy}><form className="form-stack" noValidate onSubmit={submit}><Feedback error={formError} /><Field id="catalog-name" label="Nome" name="name" required maxLength={100} defaultValue={editor === "new" ? "" : editor.name} autoFocus />
      <Select id="catalog-type" label="Tipo" name="type" defaultValue={editor === "new" ? isAccount ? "CHECKING" : "EXPENSE" : editor.type}>{Object.entries(isAccount ? accountLabels : { INCOME: "Receita", EXPENSE: "Despesa" }).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select>
      {isAccount && <BankSelect defaultValue={editor !== "new" && "initialBalance" in editor ? editor.bankCode : null} />}
      {isAccount && <Select id="catalog-currency" label="Moeda da conta" name="currency" value={accountCurrency} onChange={e => setAccountCurrency(e.target.value)}>{Object.entries(currencyLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</Select>}
      {isAccount && accountCurrency !== "BRL" && <p className="report-note">Informe os valores em {accountCurrency}. O saldo principal será exibido em reais pela cotação de referência. Contas com saldo inicial ou movimentações mantêm sua moeda.</p>}
      {isAccount && <MoneyField id="catalog-balance" label={`Saldo inicial (${accountCurrency === "BRL" ? "R$" : accountCurrency})`} name="initialBalance" defaultValue={editor !== "new" && "initialBalance" in editor ? editor.initialBalance : ""} hint="Saldo de partida, não o saldo de hoje. Alterá-lo recalcula o histórico. Se não houver saldo, digite 0." />}
      {isAccount && <label className="checkbox-field"><input type="checkbox" name="includeInTotalBalance" defaultChecked={editor === "new" || ("includeInTotalBalance" in editor && editor.includeInTotalBalance)} />Incluir no saldo geral</label>}
      <label className="checkbox-field"><input type="checkbox" name="isActive" defaultChecked={editor === "new" || editor.isActive} />{isAccount ? "Conta ativa" : "Categoria ativa"}</label><p className="muted">Desativar preserva o histórico e impede novos lançamentos.</p><button className="button primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button></form></Modal>}
    {deleting && <Modal title={`Excluir ${isAccount ? "conta" : "categoria"}?`} onClose={() => setDeleting(null)} busy={busy}><Feedback error={formError} /><p>Excluir “{deleting.name}”? Se houver lançamentos, o registro será desativado para preservar o histórico.</p><div className="record-actions"><button className="button secondary" onClick={() => setDeleting(null)} disabled={busy}>Cancelar</button><button className="button danger" onClick={remove} disabled={busy}>{busy ? "Aguarde…" : "Confirmar exclusão"}</button></div></Modal>}
  </>;
}

