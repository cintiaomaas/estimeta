"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { currency, financialRequest } from "@/lib/finance/client";

import { displayDate } from "@/lib/finance/dates";

type Notice = { id: string; description: string | null; amount: string | null; referenceDate: string; competenceDate: string | null; transactionId: string | null; createdAt: string; readAt: string | null };

type Data = { items: Notice[]; unread: number; total: number; selection: Notice | null };

export function NotificationCenter({ selected }: { selected?: string }) {

  const [data, setData] = useState<Data | null>(null);

  const [page, setPage] = useState(1);

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  const [highlight, setHighlight] = useState(selected);

  const load = useCallback(async () => {

    const result = await financialRequest<{ data: Data }>(`/api/notifications?page=${page}${selected ? `&selected=${selected}` : ""}`);

    setData(result.data);

  }, [page, selected]);

  useEffect(() => {
    let alive = true;
    let opened = false;
    const refresh = async () => {
      try {
        if (selected && !opened) {
          await financialRequest("/api/notifications", { method: "PATCH", body: JSON.stringify({ id: selected }) });
          opened = true;
          if (alive) setHighlight(selected);
          window.dispatchEvent(new Event("notifications-changed"));
        }
        if (alive) await load();
      } catch (e) { if (alive) setError((e as Error).message); }
    };
    void refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load, selected]);
  async function read(id?: string) {

    setBusy(true); setError("");

    try {

      await financialRequest("/api/notifications", { method: "PATCH", body: JSON.stringify(id ? { id } : { all: true }) });

      if (id) setHighlight(id);

      window.dispatchEvent(new Event("notifications-changed"));

      await load();

    } catch (e) { setError((e as Error).message); }

    finally { setBusy(false); }

  }

  const items = data ? (data.selection && !data.items.some(n => n.id === data.selection!.id) ? [data.selection, ...data.items] : data.items) : [];

  return <div className="notification-center"><div className="notification-heading"><div><span className="eyebrow">SEUS AVISOS</span><h1>Central de Notificações</h1><p>{data ? `${data.unread} não lidas` : "Carregando…"}</p></div><button className="button secondary" disabled={busy || !data?.unread} onClick={() => void read()}>Marcar todas como lidas</button></div>

    {error && <p className="alert error" role="alert">{error} <button onClick={() => void load().catch(e => setError(e.message))}>Tentar novamente</button></p>}

    {data && !items.length && <section className="panel"><h2>Nenhuma notificação por enquanto</h2><p>Seus avisos de vencimento aparecerão aqui, mesmo sem Push ativado.</p></section>}

    {items.map(n => <article key={n.id} id={`notice-${n.id}`} className={`panel notification-card ${n.readAt ? "" : "unread"} ${highlight === n.id ? "selected" : ""}`} aria-label={`${n.readAt ? "Lida" : "Não lida"}: Conta vencendo amanhã`}>

      <div><span className="eyebrow">{n.readAt ? "Lida" : "Não lida"}</span><h2><button className="notification-title" disabled={busy} onClick={() => void read(n.id)}>Conta vencendo amanhã</button></h2><strong>{n.description ?? "Despesa"}</strong><p>{n.amount !== null ? currency(n.amount) : ""}<br />Vencimento: {displayDate(n.referenceDate.slice(0, 10))}</p><time dateTime={n.createdAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(n.createdAt))}</time></div>

      <div className="notification-actions">{!n.readAt && <button className="button secondary" disabled={busy} onClick={() => void read(n.id)}>Marcar como lida</button>}{n.transactionId && n.competenceDate ? <Link className="button primary" href={`/despesas?period=${n.competenceDate.slice(0, 7)}&selected=${n.transactionId}`} onClick={async event => { event.preventDefault(); const href = event.currentTarget.href; setBusy(true); try { await financialRequest("/api/notifications", { method: "PATCH", body: JSON.stringify({ id: n.id }) }); window.location.assign(href); } catch (e) { setError((e as Error).message); setBusy(false); } }}>Ver despesa</Link> : <span className="muted">Despesa excluída</span>}</div>

    </article>)}

    {data && data.total > 20 && <div className="notification-actions"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page} de {Math.ceil(data.total / 20)}</span><button className="button secondary" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)}>Próxima</button></div>}

  </div>;

}

