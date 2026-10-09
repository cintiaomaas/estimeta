import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import type { PrismaClient } from "@prisma/client";
import { notifications } from "../src/services/notifications";
import { notificationClickDestination, notificationLoginDestination } from "../src/lib/notifications/navigation";

test("central isola usuários, conta não lidas e mantém leitura idempotente compartilhada", async () => {
  const rows = [{ id: "a1", userId: "a", readAt: null as Date | null }, { id: "a2", userId: "a", readAt: null as Date | null }, { id: "b1", userId: "b", readAt: null as Date | null }];
  type Where = { userId: string; id?: string; readAt?: null };
  const matches = (r: typeof rows[number], w: Where) => r.userId === w.userId && (!w.id || r.id === w.id) && (w.readAt === undefined || r.readAt === null);
  const db = { notificationLog: {
    findMany: async ({ where }: { where: Where }) => rows.filter(r => matches(r, where)),
    findFirst: async ({ where }: { where: Where }) => rows.find(r => matches(r, where)) ?? null,
    count: async ({ where }: { where: Where }) => rows.filter(r => matches(r, where)).length,
    updateMany: async ({ where, data }: { where: Where; data: { readAt: Date } }) => { const found = rows.filter(r => matches(r, where)); found.forEach(r => Object.assign(r, data)); return { count: found.length }; },
  } } as unknown as PrismaClient;
  const a = notifications(db, "a");
  assert.equal((await a.list()).unread, 2);
  assert.deepEqual((await a.list()).items.map(n => n.id), ["a1", "a2"]);
  assert.equal((await a.list(1, "b1")).selection, null);
  await assert.rejects(a.read("b1"));
  await a.read("a1"); await a.read("a1");
  assert.equal((await notifications(db, "a").list()).unread, 1);
  assert.equal((await notifications(db, "b").list()).unread, 1);
  await a.read(); assert.equal((await a.list()).unread, 0);
  assert.equal(rows[2].readAt, null);
});

test("destino do Push sobrevive ao login sem dados financeiros e rejeita redirecionamento externo", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const login = new URL(notificationClickDestination(id, false), "https://estimeta.test");
  assert.equal(notificationLoginDestination(login.searchParams.get("next")!), `/notificacoes/${id}`);
  assert.equal(notificationClickDestination(id, true), `/notificacoes?selected=${id}`);
  for (const next of ["https://evil.test", "//evil.test", "/notificacoes?amount=100", "/dashboard/../evil"]) assert.equal(notificationLoginDestination(next), "/dashboard");
});

test("SW: background sem rede, logout, expiração, troca de conta e destino seguro", async () => {
  const handlers: Record<string, (event: object) => void> = {};
  const shown: { title: string; options: { body: string } }[] = [];
  let stored: unknown;
  let opened = "";
  let closes = 0;
  const indexedDB = { open() {
    const open: Record<string, unknown> = {};
    const store = { get() { const req: Record<string, unknown> = {}; queueMicrotask(() => { req.result = stored; (req.onsuccess as () => void)(); queueMicrotask(() => (tx.oncomplete as () => void)()); }); return req; }, put(v: unknown) { stored = v; } };
    const tx: Record<string, unknown> = { objectStore: () => store };
    open.result = { transaction: () => tx, close() {} };
    queueMicrotask(() => (open.onsuccess as () => void)());
    return open;
  } };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: { addEventListener: (name: string, handler: (event: object) => void) => { handlers[name] = handler; }, location: { origin: "https://estimeta.test" }, registration: { pushManager: { getSubscription: async () => ({ endpoint: "device" }) }, getNotifications: async () => [{ close() { closes++; } }], showNotification: async (title: string, options: { body: string }) => { shown.push({ title, options }); } }, clients: { matchAll: async () => [], openWindow: async (url: string) => { opened = url; } } },
    fetch: () => assert.fail("não deve depender de rede"), indexedDB, URL,
  });
  let work: Promise<void> = Promise.resolve();
  const waitUntil = (promise: Promise<void>) => { work = promise; };
  const lease = { userId: "owner", sessionId: "session", endpoint: "device", expiresAt: "2099-01-01" };
  const message = { title: "Conta vencendo amanhã", body: "Internet — R$ 129,90", ...lease };
  const push = async () => { handlers.push({ data: { json: () => message }, waitUntil }); await work; };
  const command = async (data: object) => { handlers.message({ source: { url: "https://estimeta.test/dashboard" }, data, ports: [{ postMessage() {} }], waitUntil }); await work; };
  await command({ type: "BIND_PUSH", revision: 0, lease });
  await push(); assert.equal(shown[0].options.body, message.body);
  await command({ type: "REVOKE_PUSH" }); await push(); assert.equal(shown.length, 1); assert.equal(closes, 1);
  await command({ type: "BIND_PUSH", revision: 0, lease }); await push(); assert.equal(shown.length, 1);
  await command({ type: "BIND_PUSH", revision: 1, lease }); await push(); assert.equal(shown.length, 1);
  await command({ type: "BIND_PUSH", revision: 1, explicit: true, lease: { ...lease, expiresAt: "2000-01-01" } }); await push(); assert.equal(shown.length, 1);
  await command({ type: "BIND_PUSH", revision: 1, explicit: true, lease: { ...lease, userId: "other" } }); await push(); assert.equal(shown.length, 1);
  const id = "11111111-1111-4111-8111-111111111111";
  handlers.notificationclick({ notification: { close() {}, data: { url: `/notificacoes/${id}` } }, waitUntil }); await work;
  assert.equal(opened, `https://estimeta.test/notificacoes/${id}`);
  handlers.notificationclick({ notification: { close() {}, data: { url: "https://evil.test" } }, waitUntil }); await work;
  assert.equal(opened, "https://estimeta.test/notificacoes");
  assert.equal(handlers.fetch, undefined);
});
