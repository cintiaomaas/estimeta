"use client";
import { CalendarPlus, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { RowActions, type RowAction } from "./transaction-actions";
import type { AdvancedRecord } from "./advanced-forms";
import { currency } from "@/lib/finance/client";
import { displayDate, displayCompetence } from "@/lib/finance/dates";

export function AdvancedList({ rows, recurring, onDetails, onEdit, onGenerate, onToggle, onDelete }: {
  rows: AdvancedRecord[]; recurring: boolean;
  onDetails: (row: AdvancedRecord) => void; onEdit: (row: AdvancedRecord) => void;
  onGenerate: (row: AdvancedRecord) => void; onToggle: (row: AdvancedRecord) => void; onDelete: (row: AdvancedRecord) => void;
}) {
  const title = (row: AdvancedRecord) => recurring ? row.description : `${row.sourceAccount.name} → ${row.destinationAccount.name}`;
  const type = (row: AdvancedRecord) => row.type === "INCOME" ? "Receita" : "Despesa";
  const next = (row: AdvancedRecord) => row.nextScheduledDate ? displayDate(row.nextScheduledDate) : "Sem próximo lançamento";
  function actions(row: AdvancedRecord) {
    const items: RowAction[] = [{ label: "Editar", icon: Pencil, onSelect: () => onEdit(row) }];
    if (recurring) {
      if (row.isActive) items.push({ label: "Gerar competência", icon: CalendarPlus, onSelect: () => onGenerate(row) });
      items.push({ label: row.isActive ? "Desativar" : "Ativar", icon: row.isActive ? Pause : Play, onSelect: () => onToggle(row) });
    } else items.push({ label: "Excluir", icon: Trash2, danger: true, onSelect: () => onDelete(row) });
    return <RowActions description={title(row)} items={items} />;
  }
  return <>
    <div className="ledger-desktop"><table className={`ledger-table advanced-ledger ${recurring ? "recurring-ledger" : "transfer-ledger"}`}><caption className="ledger-caption">{recurring ? "Recorrências" : "Transferências"} — selecione a descrição para ver os detalhes</caption><thead><tr>
      {(recurring ? ["Descrição", "Tipo", "Frequência", "Próximo lançamento", "Status"] : ["Origem → Destino", "Data", "Competência"]).map((label) => <th scope="col" key={label}>{label}</th>)}
      <th scope="col" className="ledger-value">Valor</th><th scope="col" className="ledger-action-heading">Ações</th>
    </tr></thead><tbody>{rows.map((row) => <tr key={row.id} onClick={() => onDetails(row)}>
      <td><button className="ledger-description" aria-label={`Ver detalhes de ${title(row)}`} onClick={(e) => { e.stopPropagation(); onDetails(row); }}><strong>{title(row)}</strong><span>{recurring ? `${row.category.name} · ${row.account.name}` : row.description}</span></button></td>
      {recurring ? <><td>{type(row)}</td><td>Mensal · dia {row.dayOfMonth}</td><td>{next(row)}</td><td><span className="ledger-status">{row.isActive ? "Ativa" : "Desativada"}</span></td></> : <><td>{displayDate(row.transferDate)}</td><td>{displayCompetence(row.competenceDate)}</td></>}
      <td className="ledger-value"><strong className="ledger-amount">{currency(row.amount)}</strong></td><td><div className="ledger-actions">{actions(row)}</div></td>
    </tr>)}</tbody></table></div>
    <ul className="ledger-mobile advanced-mobile" aria-label={recurring ? "Recorrências" : "Transferências"}>{rows.map((row) => <li key={row.id}>
      <button className="ledger-mobile-entry" aria-label={`Ver detalhes de ${title(row)}, ${currency(row.amount)}`} onClick={() => onDetails(row)}><span className="ledger-mobile-title">{title(row)}</span><strong className="ledger-amount">{currency(row.amount)}</strong>
        {recurring ? <><span className="ledger-mobile-date">{type(row)} · Mensal · dia {row.dayOfMonth}</span><span className="ledger-mobile-date">Próximo: {next(row)} · {row.isActive ? "Ativa" : "Desativada"}</span></> : <span className="ledger-mobile-date">{displayDate(row.transferDate)} · Competência {displayCompetence(row.competenceDate)}</span>}
      </button>{actions(row)}
    </li>)}</ul>
  </>;
}
