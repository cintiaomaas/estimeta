/* Push only: no fetch handler, cache, offline queue or financial persistence. */
self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let message;
    try { message = event.data?.json(); } catch { return; }
    if (!message || typeof message.title !== "string" || typeof message.body !== "string") return;
    // Protect shared devices after sign-out, session expiry or account changes.
    let sameUser = false;
    try {
      const response = await fetch("/api/users/me", { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(3000) });
      const current = response.ok ? await response.json() : null;
      sameUser = typeof message.userId === "string" && current?.data?.user?.id === message.userId;
    } catch { /* Offline: show a generic reminder without financial details. */ }
    await self.registration.showNotification(sameUser ? message.title : "estimeta", {
      body: sameUser ? message.body : "Você tem um aviso financeiro. Entre na sua conta para consultar.",
      icon: "/icons/icon-192.png", badge: "/icons/icon-192.png",
      tag: typeof message.tag === "string" ? message.tag : "estimeta-reminder",
      data: { url: sameUser ? message.url : "/login" },
    });
  })());
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    let target = new URL("/despesas", self.location.origin);
    try {
      const candidate = new URL(event.notification.data?.url, self.location.origin);
      if (candidate.origin === self.location.origin && ["/despesas", "/login"].includes(candidate.pathname)) target = candidate;
    } catch { /* Keep the safe application route. */ }
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      const navigated = await existing.navigate(target.href);
      if (navigated) return navigated.focus();
    }
    return self.clients.openWindow(target.href);
  })());
});
