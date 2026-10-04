"use client";
import { useCallback, useEffect, useState } from "react";
import { deviceSubscription, disablePush, enablePush, subscriptionActive, supportsPush } from "@/lib/push/browser";

type State = "loading" | "active" | "inactive" | "blocked" | "unsupported" | "error";
const labels: Record<State, string> = {
  loading: "Verificando notificações…", active: "Notificações ativadas", inactive: "Notificações desativadas",
  blocked: "Permissão de notificações bloqueada pelo navegador", unsupported: "Navegador não compatível",
  error: "Não foi possível consultar o estado das notificações",
};
export function NotificationSettings() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const refresh = useCallback(async () => {
    if (!supportsPush()) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("blocked"); return; }
    try {
      const subscription = await deviceSubscription();
      setState(subscription && await subscriptionActive(subscription) ? "active" : "inactive");
    } catch { setState("error"); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    window.addEventListener("focus", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, [refresh]);
  async function toggle() {
    setBusy(true); setError("");
    try {
      if (state === "active") {
        const subscription = await deviceSubscription();
        if (subscription) await disablePush(subscription);
        setState("inactive");
      } else {
        const permission = await enablePush(publicKey);
        setState(permission === "granted" ? "active" : permission === "denied" ? "blocked" : "inactive");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível alterar as notificações. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <section className="panel settings-panel" aria-labelledby="notifications-title">
    <h2 id="notifications-title">Notificações</h2>
    <p>Receber avisos de despesas próximas do vencimento</p>
    <p className="muted">Avise-me um dia antes das despesas que cadastrei. A ativação vale para este navegador ou dispositivo; você pode desativá-la quando quiser. Descrição, valor e vencimento poderão aparecer na tela bloqueada.</p>
    <p role="status" aria-live="polite">{labels[state]}</p>
    {state === "blocked" && <p className="muted">Libere a permissão nas configurações deste site no navegador e volte a esta tela.</p>}
    {state === "unsupported" && <p className="muted">Use um navegador com Web Push em uma conexão HTTPS, como Chrome ou Edge. O aplicativo continua disponível sem notificações.</p>}
    {!publicKey && state !== "unsupported" && <p className="muted">O administrador ainda precisa configurar as notificações.</p>}
    {(state === "active" || state === "inactive") && <button type="button" className="button primary" disabled={busy || (!publicKey && state !== "active")} onClick={toggle}>{busy ? "Salvando…" : state === "active" ? "Desativar notificações" : "Ativar notificações"}</button>}
    {state === "error" && <button type="button" className="button secondary" onClick={() => void refresh()}>Tentar novamente</button>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
