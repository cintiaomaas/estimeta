"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { financialRequest } from "@/lib/finance/client";
import { refreshPushAuthorization } from "@/lib/push/browser";
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void financialRequest<{ data: { unread: number } }>("/api/notifications").then(r => { if (alive) setUnread(r.data.unread); }).catch(() => {});
    };
    const focus = () => { refresh(); void refreshPushAuthorization().catch(() => {}); };
    focus();
    const timer = setInterval(focus, 60000);
    window.addEventListener("focus", focus);
    window.addEventListener("notifications-changed", refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", focus); window.removeEventListener("notifications-changed", refresh); };
  }, []);
  return <Link className="notification-bell" href="/notificacoes" aria-label={`Notificações${unread ? `: ${unread} não lidas` : ""}`}><Bell size={22} />{unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}</Link>;
}
