import { financialRequest } from "../finance/client";

export function supportsPush() {
  return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
export async function deviceSubscription() {
  if (!supportsPush()) return null;
  return (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription() ?? null;
}
export async function subscriptionActive(subscription: PushSubscription) {
  const result = await financialRequest<{ data: { active: boolean } }>("/api/push/subscriptions/status", {
    method: "POST", body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  return result.data.active;
}
function waitForWorker(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (registration.active) return Promise.resolve(registration);
  return new Promise((resolve, reject) => {
    const worker = registration.installing ?? registration.waiting;
    if (!worker) { reject(new Error("Service Worker indisponível. Tente novamente.")); return; }
    const finish = () => {
      if (worker.state === "activated") { cleanup(); resolve(registration); }
      else if (worker.state === "redundant") { cleanup(); reject(new Error("Falha ao ativar o Service Worker.")); }
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error("O Service Worker demorou para responder. Tente novamente.")); }, 10000);
    const cleanup = () => { clearTimeout(timer); worker.removeEventListener("statechange", finish); };
    worker.addEventListener("statechange", finish);
    finish();
  });
}
export async function enablePush(publicKey: string): Promise<NotificationPermission> {
  if (!supportsPush()) throw new Error("Navegador não compatível. Use HTTPS ou localhost.");
  if (!publicKey) throw new Error("Notificações ainda não configuradas no servidor.");
  // Called only inside the explicit button handler, before any asynchronous work.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  let registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  await waitForWorker(registration);
  let subscription = await registration.pushManager.getSubscription();
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
  if (subscription?.options.applicationServerKey &&
    Array.from(new Uint8Array(subscription.options.applicationServerKey)).join() !== Array.from(key).join()) {
    await disablePush(subscription);
    subscription = null;
  }
  const created = !subscription;
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  try {
    await financialRequest("/api/push/subscriptions", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
  } catch (error) {
    if (created) await subscription.unsubscribe().catch(() => false);
    throw error;
  }
  return permission;
}
export async function disablePush(subscription: PushSubscription) {
  // Persist opt-out first: a browser unsubscribe failure must not leave sends enabled.
  await financialRequest("/api/push/subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint: subscription.endpoint }) });
  await subscription.unsubscribe();
}
export async function clearPushOnLogout() {
  const subscription = await deviceSubscription();
  if (!subscription) return;
  try { await disablePush(subscription); }
  catch {
    // Even without network, revoke the browser endpoint before leaving the account.
    await subscription.unsubscribe().catch(() => false);
  }
  const registration = await navigator.serviceWorker.getRegistration("/");
  for (const notification of await registration?.getNotifications() ?? []) notification.close();
}
