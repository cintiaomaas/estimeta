import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { Prisma, type PrismaClient } from "@prisma/client";
import { tomorrowInBrazil } from "../src/lib/push/due-date";
import { authorizedCron } from "../src/lib/push/cron-auth";
import { isPushEndpoint, pushSubscriptionSchema } from "../src/lib/validations/push";
import { dueExpenseWhere, sendDueNotifications, type PushMessage } from "../src/services/due-notifications";
import { enablePush } from "../src/lib/push/browser";

test("amanhã usa calendário brasileiro, viradas de mês/ano e ano bissexto", () => {
  for (const [now, expected] of [
    ["2026-10-10T02:59:59Z", "2026-10-10"], ["2026-10-10T03:00:00Z", "2026-10-11"],
    ["2026-12-31T15:00:00Z", "2027-01-01"], ["2028-02-28T15:00:00Z", "2028-02-29"],
  ]) assert.equal(tomorrowInBrazil(new Date(now)).toISOString(), `${expected}T00:00:00.000Z`);
  assert.deepEqual(dueExpenseWhere(new Date("2026-10-09T12:00:00Z")), {
    type: "EXPENSE", status: "PENDING", scheduledDate: new Date("2026-10-10T00:00:00Z"),
    creator: { pushSubscriptions: { some: { active: true } } },
  });
});

test("cron falha fechado sem secret, secret curto, token errado e tamanho diferente", () => {
  const secret = "a".repeat(32);
  assert.equal(authorizedCron(`Bearer ${secret}`, secret), true);
  for (const header of [null, secret, "Bearer wrong", `Bearer ${"b".repeat(32)}`]) assert.equal(authorizedCron(header, secret), false);
  assert.equal(authorizedCron("Bearer undefined", undefined), false);
  assert.equal(authorizedCron("Bearer short", "short"), false);
});

test("subscriptions validam chaves e rejeitam destinos internos/SSRF e campos de proprietário", () => {
  assert.ok(isPushEndpoint("https://fcm.googleapis.com/fcm/send/test"));
  assert.ok(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/test"));
  for (const endpoint of ["http://fcm.googleapis.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://fcm.googleapis.com.evil.test/x", "https://fcm.googleapis.com:444/x", "https://user:pass@fcm.googleapis.com/x"]) assert.equal(isPushEndpoint(endpoint), false);
  const input = { endpoint: "https://fcm.googleapis.com/fcm/send/test", keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) } };
  assert.ok(pushSubscriptionSchema.safeParse(input).success);
  assert.equal(pushSubscriptionSchema.safeParse({ ...input, userId: "another" }).success, false);
  assert.equal(pushSubscriptionSchema.safeParse({ ...input, keys: { auth: "invalid", p256dh: "invalid" } }).success, false);
});

function fakeJobDatabase(deviceCount = 2) {
  const expense = { id: "expense", createdBy: "owner", householdId: "home", description: "Internet", amount: new Prisma.Decimal("129.90"), scheduledDate: new Date("2026-10-10Z"), competenceDate: new Date("2026-11-01Z") };
  const subscriptions = Array.from({ length: deviceCount }, (_, index) => ({ id: `device${index}`, userId: "owner", endpointHash: `hash${index}`, active: true, updatedAt: new Date() }));
  const claims = new Map<string, { id: string; status: string; sentAt?: Date }>();
  let sentAt: Date | null = null;
  const duplicate = () => new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
  const db = {
    transaction: { findMany: async () => subscriptions.some(s => s.active) ? [expense] : [], findFirst: async () => expense },
    notificationLog: {
      upsert: async () => ({ id: "log" }),
      updateMany: async ({ data }: { data: { sentAt: Date } }) => { sentAt ??= data.sentAt; },
    },
    pushSubscription: {
      findMany: async () => subscriptions.filter(s => s.active),
      updateMany: async ({ where }: { where: { id: string } }) => { subscriptions.find(s => s.id === where.id)!.active = false; },
    },
    notificationDelivery: {
      create: async ({ data }: { data: { endpointHash: string } }) => {
        if (claims.has(data.endpointHash)) throw duplicate();
        const row = { id: data.endpointHash, status: "CLAIMED" }; claims.set(data.endpointHash, row); return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: { status: string; sentAt?: Date } }) => Object.assign(claims.get(where.id)!, data),
    },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  } as unknown as PrismaClient;
  return { db, claims, subscriptions, sentAt: () => sentAt };
}

test("jobs repetidos e concorrentes reservam uma única entrega por dispositivo", async () => {
  const fixture = fakeJobDatabase();
  const messages: PushMessage[] = [];
  const send = async (_subscription: unknown, message: PushMessage) => { messages.push(message); };
  const now = new Date("2026-10-09T12:00:00Z");
  await Promise.all([sendDueNotifications(fixture.db, send, now), sendDueNotifications(fixture.db, send, now)]);
  await sendDueNotifications(fixture.db, send, now);
  assert.equal(messages.length, 2);
  assert.equal(fixture.claims.size, 2);
  assert.ok(fixture.sentAt());
  assert.equal(messages[0].body, "Internet — R$ 129,90\nVencimento: 10/10/2026");
  assert.equal(messages[0].url, "/despesas?period=2026-11");
  assert.equal(messages[0].userId, "owner");
});

test("sem inscrições não envia; 404/410 desativa somente o dispositivo expirado", async () => {
  const empty = fakeJobDatabase(0);
  await sendDueNotifications(empty.db, async () => assert.fail("não deve enviar"));
  assert.equal(empty.claims.size, 0);
  for (const statusCode of [404, 410]) {
    const fixture = fakeJobDatabase();
    const result = await sendDueNotifications(fixture.db, async s => { if (s.id === "device0") throw { statusCode }; });
    assert.equal(result.expired, 1); assert.equal(result.sent, 1);
    assert.equal(fixture.subscriptions[0].active, false);
    assert.equal(fixture.subscriptions[1].active, true);
  }
});

test("falhas do provedor e falhas após envio não repetem tentativas incertas", async () => {
  const fixture = fakeJobDatabase(1);
  let sends = 0;
  const send = async () => { sends++; throw new Error("timeout"); };
  const first = await sendDueNotifications(fixture.db, send);
  await sendDueNotifications(fixture.db, send);
  assert.equal(first.failed, 1); assert.equal(sends, 1);
  assert.equal(fixture.subscriptions[0].active, true);
  assert.equal(fixture.sentAt(), null);
  const crash = fakeJobDatabase(1);
  crash.db.$transaction = async () => { throw new Error("database unavailable after accepted push"); };
  sends = 0;
  await assert.rejects(sendDueNotifications(crash.db, async () => { sends++; }));
  await sendDueNotifications(crash.db, async () => { sends++; });
  assert.equal(sends, 1);
});

test("negação de permissão encerra ativação normalmente sem registrar SW, inscrição ou backend", async () => {
  const originals = ["window", "navigator", "Notification"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  let requests = 0;
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: { isSecureContext: true, PushManager: {}, Notification: {} } });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker: { getRegistration: () => assert.fail("não deve registrar") } } });
    Object.defineProperty(globalThis, "Notification", { configurable: true, value: { requestPermission: async () => { requests++; return "denied"; } } });
    assert.equal(await enablePush("public-key"), "denied");
    assert.equal(requests, 1);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("SW mostra conteúdo autorizado, protege outras contas e limita navegação à origem", async () => {
  const handlers: Record<string, (event: object) => void> = {};
  const shown: { title: string; options: { body: string } }[] = [];
  let currentUser = "owner";
  let opened = "";
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: { addEventListener: (name: string, handler: (event: object) => void) => { handlers[name] = handler; }, location: { origin: "https://estimeta.test" }, registration: { showNotification: async (title: string, options: { body: string }) => { shown.push({ title, options }); } }, clients: { matchAll: async () => [], openWindow: async (url: string) => { opened = url; } } },
    fetch: async () => ({ ok: true, json: async () => ({ data: { user: { id: currentUser } } }) }), URL, AbortSignal,
  });
  let work: Promise<void> = Promise.resolve();
  const waitUntil = (promise: Promise<void>) => { work = promise; };
  const data = { json: () => ({ title: "Conta vencendo amanhã", body: "Internet — R$ 129,90", userId: "owner" }) };
  handlers.push({ data, waitUntil }); await work;
  assert.equal(shown[0].options.body, "Internet — R$ 129,90");
  currentUser = "other";
  handlers.push({ data, waitUntil }); await work;
  assert.equal(shown[1].options.body.includes("129"), false);
  handlers.notificationclick({ notification: { close() {}, data: { url: "https://evil.test" } }, waitUntil }); await work;
  assert.equal(opened, "https://estimeta.test/despesas");
  assert.equal(handlers.fetch, undefined);
});
