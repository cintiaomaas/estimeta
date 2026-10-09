"use client";
import { useEffect, useState } from "react";
import { Pencil, Copy, Trash2 } from "lucide-react";
import { TransactionActions } from "./transaction-actions";
import { Modal } from "./controls";
import { currency, statusLabels, financialRequest, type TransactionRecord } from "@/lib/finance/client";
import { displayDate, displayCompetence } from "@/lib/finance/dates";

export function TransactionList({ rows, onEdit, onDelete, onRepeat, selectedId }: { rows: TransactionRecord[]; selectedId?: string; onRepeat: (row: TransactionRecord) => void; onEdit: (row: TransactionRecord) => void; onDelete: (row: TransactionRecord) => void }) {
  const [details, setDetails] = useState<TransactionRecord | null>(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    void financialRequest<{ data: TransactionRecord }>(`/api/transactions/${selectedId}`, { signal: controller.signal }).then(r => { if (!controller.signal.aborted) setDetails(r.data); }).catch(e => { if (!controller.signal.aborted) setLoadError(e.message); });
    return () => controller.abort();
  }, [selectedId]);
  const actions = (row: TransactionRecord) => <TransactionActions description={row.description} onDetails={() => setDetails(row)} onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} />;
  const amount = (row: TransactionRecord) => <strong className={`ledger-amount ${row.type.toLowerCase()}`}>{row.type === "INCOME" ? "+" : "−"} {currency(row.amount)}</strong>;
  const status = (row: TransactionRecord) => <span className={`status-chip ${row.displayStatus.toLowerCase()}`}>{statusLabels[row.displayStatus]}</span>;
  return <>
    {loadError && <p role="alert">{loadError}</p>}
    <div className="ledger-desktop"><table className="ledger-table"><caption className="ledger-caption">Lançamentos — selecione a descrição para ver os detalhes</caption><thead><tr><th scope="col">Descrição / Categoria</th><th scope="col">Competência</th><th scope="col">Data prevista</th><th scope="col">Conta</th><th scope="col">Status</th><th scope="col" className="ledger-value">Valor</th><th scope="col">Ações</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} onClick={() => setDetails(row)}>
      <td><button className="ledger-description" onClick={(event) => { event.stopPropagation(); setDetails(row); }} aria-label={`Ver detalhes de ${row.description}`}><strong>{row.description}{row.installmentPlanId && ` · ${row.installmentNumber}/${row.installmentCount}`}{row.recurringOccurrenceId && " · Mensal"}</strong><span>{row.category.name}</span></button></td>
      <td>{displayCompetence(row.competenceDate)}</td><td>{displayDate(row.scheduledDate)}</td><td className="ledger-account">{row.account.name}</td><td>{status(row)}</td><td className="ledger-value">{amount(row)}</td>
      <td><div className="ledger-actions">{actions(row)}</div></td>
    </tr>)}</tbody></table></div>
    <ul className="ledger-mobile" aria-label="Lançamentos">{rows.map((row) => <li key={row.id}><button className="ledger-mobile-entry" onClick={() => setDetails(row)} aria-label={`Ver detalhes de ${row.description}, ${currency(row.amount)}, ${statusLabels[row.displayStatus]}`}><span className="ledger-mobile-title">{row.description}{row.installmentPlanId && ` · ${row.installmentNumber}/${row.installmentCount}`}{row.recurringOccurrenceId && " · Mensal"}</span>{amount(row)}<span className="ledger-mobile-date">Previsto: {displayDate(row.scheduledDate)}</span>{status(row)}</button>{actions(row)}</li>)}</ul>

    {details && <Modal drawer title="Detalhes do lançamento" onClose={() => setDetails(null)}><h3 className="ledger-detail-title">{details.description}</h3>{details.installmentPlanId && <p>Parcela {details.installmentNumber}/{details.installmentCount}</p>}{details.recurringOccurrenceId && <p>Origem: recorrência mensal</p>}{amount(details)}<dl className="transaction-details ledger-details"><div><dt>Tipo</dt><dd>{details.type === "INCOME" ? "Receita" : "Despesa"}</dd></div><div><dt>Categoria</dt><dd>{details.category.name}</dd></div><div><dt>Conta</dt><dd>{details.account.name}</dd></div><div><dt>Competência</dt><dd>{displayCompetence(details.competenceDate)}</dd></div><div><dt>Data prevista</dt><dd>{displayDate(details.scheduledDate)}</dd></div><div><dt>Data efetiva</dt><dd>{displayDate(details.transactionDate)}</dd></div><div><dt>Status</dt><dd>{status(details)}</dd></div></dl>{details.notes && <div className="transaction-notes"><h4>Observações</h4><p>{details.notes}</p></div>}<div className="record-actions"><button className="button primary" onClick={() => { onEdit(details); setDetails(null); }}><Pencil size={18} />Editar lançamento</button><button className="button secondary" disabled={details.competenceDate.startsWith("9999-12") || details.scheduledDate.startsWith("9999-12")} onClick={() => { onRepeat(details); setDetails(null); }}><Copy size={18} />Repetir</button><button className="button danger" onClick={() => { onDelete(details); setDetails(null); }}><Trash2 size={18} />{details.installmentPlanId ? "Excluir somente esta parcela" : "Excluir"}</button></div></Modal>}
  </>;
}
