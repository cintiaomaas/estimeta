export function FormActions({ busy, onCancel, label = "Salvar" }: { busy: boolean; onCancel: () => void; label?: string }) {
  return <div className="record-actions"><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Salvando…" : label}</button></div>;
}
