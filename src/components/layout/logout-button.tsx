"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { clearPushOnLogout } from "@/lib/push/browser";
export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <><button className="logout-button" disabled={busy} onClick={async () => { setBusy(true); setError(false); try { await clearPushOnLogout(); await signOut({ callbackUrl: "/login" }); } catch { setError(true); setBusy(false); } }}><LogOut size={18} aria-hidden="true" />{busy ? "Saindo…" : "Sair da conta"}</button>{error && <p role="alert">Não foi possível sair. Tente novamente.</p>}</>;
}
