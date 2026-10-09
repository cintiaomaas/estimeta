/* Persist authorization metadata only; never cache financial data. */
function state(action) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("estimeta-push", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("authorization");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("authorization", "readwrite");
      const store = tx.objectStore("authorization");
      const request = store.get("current");
      let result;
      request.onsuccess = () => { result = action(request.result || { revision: 0, lease: null }); store.put(result, "current"); };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}
let queue = Promise.resolve();
function enqueue(event, work) {
  const task = queue.then(work);
  queue = task.catch(() => {});
  event.waitUntil(task);
}
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("message", event => {
  if (!event.source || new URL(event.source.url).origin !== self.location.origin) return;
  enqueue(event, async () => {
    try {
      const current = await state(value => {
        if (event.data?.type === "REVOKE_PUSH") return { revision: value.revision + 1, lease: null, blocked: true };
        if (event.data?.type === "BIND_PUSH" && value.revision === event.data.revision && (!value.blocked || event.data.explicit === true)) return { revision: value.revision, lease: event.data.lease };
        return value;
      });
      if (event.data?.type === "REVOKE_PUSH") for (const n of await self.registration.getNotifications()) n.close();
      event.ports[0]?.postMessage({ ok: true, ...current });
    } catch { event.ports[0]?.postMessage({ ok: false }); }
  });
});
self.addEventListener("push", event => enqueue(event, async () => {
  let message;
  try { message = event.data?.json(); } catch { return; }
  if (!message || typeof message.title !== "string" || typeof message.body !== "string") return;
  let authorized = false;
  try {
    const { lease } = await state(value => value);
    const subscription = await self.registration.pushManager.getSubscription();
    authorized = !!lease && lease.userId === message.userId && lease.sessionId === message.sessionId &&
      lease.endpoint === subscription?.endpoint && Date.parse(lease.expiresAt) > Date.now() && Date.parse(message.expiresAt) > Date.now();
  } catch { /* Missing authorization fails closed, without relying on a network probe. */ }
  if (!authorized) return;
  await self.registration.showNotification(message.title, {
    body: message.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png",
    tag: typeof message.tag === "string" ? message.tag : "estimeta-reminder",
    data: { url: message.url },
  });
}));
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    let target = new URL("/notificacoes", self.location.origin);
    try {
      const candidate = new URL(event.notification.data?.url, self.location.origin);
      if (candidate.origin === self.location.origin && /^\/notificacoes(?:\/[a-f0-9-]{36})?$/.test(candidate.pathname) && !candidate.search) target = candidate;
    } catch { /* Keep the safe route. */ }
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { const navigated = await existing.navigate(target.href); if (navigated) return navigated.focus(); }
    return self.clients.openWindow(target.href);
  })());
});
