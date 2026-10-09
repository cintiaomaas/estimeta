import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createECDH } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const origin = process.env.TEST_BASE_URL ?? "http://localhost:3000";
test("Web Push HTTP: sessão, origem, propriedade, validação e proteção do cron", async () => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const db = new PrismaClient();
  const ids = [randomUUID(), randomUUID()];
  const households = [randomUUID(), randomUUID()];
  const password = `Qa-${randomUUID()}-9a`;
  const passwordHash = await hash(password, 10);
  async function login(email: string) {
    const csrfResponse = await fetch(`${origin}/api/auth/csrf`);
    const cookieMap = new Map<string, string>();
    function cookies(response: Response) {
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";")[0]; const index = pair.indexOf("=");
        cookieMap.set(pair.slice(0, index), pair.slice(index + 1));
      }
      return [...cookieMap].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    const csrf = await csrfResponse.json();
    const response = await fetch(`${origin}/api/auth/callback/credentials`, {
      method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin, Cookie: cookies(csrfResponse) },
      body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${origin}/dashboard` }),
    });
    assert.equal(response.status, 302);
    return cookies(response);
  }
  const request = (path: string, method: string, body: unknown, cookie = "", requestOrigin = origin) => fetch(`${origin}${path}`, {
    method, headers: { "Content-Type": "application/json", Origin: requestOrigin, Cookie: cookie }, body: JSON.stringify(body),
  });
  try {
    for (let i = 0; i < ids.length; i++) await db.user.create({ data: { id: ids[i], name: "Push HTTP QA", email: `${ids[i]}@example.invalid`, passwordHash, membership: { create: { household: { create: { id: households[i], name: "Push HTTP QA" } } } } } });
    const [a, b] = await Promise.all(ids.map(id => login(`${id}@example.invalid`)));
    const notices = await Promise.all(ids.map(userId => db.notificationLog.create({ data: { userId, type: "EXPENSE_DUE_TOMORROW", referenceDate: new Date("2040-10-10Z"), description: "Internet", amount: "129.90" } })));
    assert.equal((await fetch(`${origin}/api/notifications`)).status, 401);
    const own = await fetch(`${origin}/api/notifications`, { headers: { Cookie: a } });
    assert.equal(own.headers.get("cache-control"), "private, no-store");
    const ownData = (await own.json()).data;
    assert.deepEqual(ownData.items.map((n: { id: string }) => n.id), [notices[0].id]);
    assert.equal(ownData.unread, 1);
    assert.equal((await request("/api/notifications", "PATCH", { id: notices[1].id }, a)).status, 404);
    assert.equal((await request("/api/notifications", "PATCH", { all: true }, a, "https://evil.test")).status, 403);
    assert.equal((await request("/api/notifications", "PATCH", { id: notices[0].id }, a)).status, 200);
    assert.equal((await (await fetch(`${origin}/api/notifications`, { headers: { Cookie: a } })).json()).data.unread, 0);
    assert.equal((await (await fetch(`${origin}/api/notifications`, { headers: { Cookie: b } })).json()).data.unread, 1);
    assert.equal((await request("/api/notifications", "PATCH", { all: true }, b)).status, 200);
    const clicked = await fetch(`${origin}/notificacoes/${notices[0].id}`, { redirect: "manual" });
    assert.equal(new URL(clicked.headers.get("location")!).searchParams.get("next"), `/notificacoes/${notices[0].id}`);
    const authenticatedClick = await fetch(`${origin}/notificacoes/${notices[0].id}`, { redirect: "manual", headers: { Cookie: a } });
    assert.equal(new URL(authenticatedClick.headers.get("location")!).searchParams.get("selected"), notices[0].id);
    const key = createECDH("prime256v1"); key.generateKeys();
    const subscription = { endpoint: `https://fcm.googleapis.com/fcm/send/qa-${randomUUID()}`, expirationTime: null, keys: { p256dh: key.getPublicKey().toString("base64url"), auth: Buffer.alloc(16, 3).toString("base64url") } };
    const endpoint = { endpoint: subscription.endpoint };
    for (const [path, method] of [["/api/push/subscriptions", "POST"], ["/api/push/subscriptions", "DELETE"], ["/api/push/subscriptions/status", "POST"]]) {
      assert.equal((await request(path, method, endpoint)).status, 401);
      assert.equal((await request(path, method, endpoint, a, "https://evil.test")).status, 403);
    }
    assert.equal((await request("/api/push/subscriptions", "POST", { ...subscription, userId: ids[1] }, a)).status, 400);
    assert.equal((await request("/api/push/subscriptions", "POST", { ...subscription, endpoint: "https://127.0.0.1/private" }, a)).status, 400);
    const saved = await request("/api/push/subscriptions", "POST", subscription, a);
    assert.equal(saved.status, 200); assert.equal(saved.headers.get("cache-control"), "private, no-store");
    const savedData = (await saved.json()).data;
    assert.equal(savedData.active, true); assert.equal(savedData.userId, ids[0]); assert.ok(savedData.sessionId); assert.ok(Date.parse(savedData.expiresAt) > Date.now());
    assert.equal((await request("/api/push/subscriptions", "POST", subscription, b)).status, 409);
    assert.deepEqual(await (await request("/api/push/subscriptions/status", "POST", endpoint, b)).json(), { data: { active: false } });
    await request("/api/push/subscriptions", "DELETE", endpoint, b);
    assert.deepEqual(await (await request("/api/push/subscriptions/status", "POST", endpoint, a)).json(), { data: { active: true } });
    await request("/api/push/subscriptions", "DELETE", endpoint, a);
    assert.deepEqual(await (await request("/api/push/subscriptions/status", "POST", endpoint, a)).json(), { data: { active: false } });
    assert.equal((await fetch(`${origin}/api/cron/due-notifications`)).status, 401);
    assert.equal((await fetch(`${origin}/api/cron/due-notifications`, { headers: { Authorization: "Bearer wrong" } })).status, 401);
    const sw = await fetch(`${origin}/sw.js`);
    assert.equal(sw.status, 200); assert.match(sw.headers.get("cache-control") ?? "", /no-store/);
    const settings = await fetch(`${origin}/configuracoes`, { headers: { Cookie: a } });
    assert.match(await settings.text(), /Receber avisos de despesas próximas do vencimento/);
  } finally {
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.household.deleteMany({ where: { id: { in: households } } });
    await db.$disconnect();
  }
});
