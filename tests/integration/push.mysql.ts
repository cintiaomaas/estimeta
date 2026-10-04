import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createECDH } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { pushSubscriptions } from "../../src/services/push-subscriptions";
import { sendDueNotifications, dueExpenseWhere } from "../../src/services/due-notifications";

test("Web Push MySQL: seleção, isolamento, concorrência e persistência", async () => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const db = new PrismaClient();
  const users = [randomUUID(), randomUUID(), randomUUID()];
  const homes = [randomUUID(), randomUUID(), randomUUID()];
  const now = new Date("2040-10-09T12:00:00Z");
  const key = createECDH("prime256v1"); key.generateKeys();
  const subscription = { endpoint: `https://fcm.googleapis.com/fcm/send/qa-${randomUUID()}`, keys: { p256dh: key.getPublicKey().toString("base64url"), auth: Buffer.alloc(16, 1).toString("base64url") } };
  try {
    for (let i = 0; i < users.length; i++) await db.user.create({ data: { id: users[i], name: "Push QA", email: `push-${users[i]}@example.invalid`, passwordHash: "not-a-password", membership: { create: { household: { create: { id: homes[i], name: "Push QA" } } } } } });
    const a = pushSubscriptions(db, users[0]);
    const b = pushSubscriptions(db, users[1]);
    await a.save(subscription);
    assert.deepEqual(await a.status(subscriptionEndpoint()), { active: true });
    assert.deepEqual(await b.status(subscriptionEndpoint()), { active: false });
    await assert.rejects(b.save(subscription));
    await b.remove(subscriptionEndpoint());
    assert.deepEqual(await a.status(subscriptionEndpoint()), { active: true });
    await a.remove(subscriptionEndpoint());
    assert.deepEqual(await a.status(subscriptionEndpoint()), { active: false });
    await a.save(subscription);
    const second = { ...subscription, endpoint: `${subscription.endpoint}-second` };
    await a.save(second);
    const transactions: string[] = [];
    for (let i = 0; i < users.length; i++) {
      const account = await db.account.create({ data: { householdId: homes[i], name: "QA", type: "CASH" } });
      const category = await db.category.create({ data: { householdId: homes[i], name: "QA", type: "EXPENSE" } });
      for (const [status, date] of [["PENDING", "2040-10-10"], ["PAID", "2040-10-10"], ["PENDING", "2040-10-11"]] as const) {
        const row = await db.transaction.create({ data: { householdId: homes[i], accountId: account.id, categoryId: category.id, createdBy: users[i], type: "EXPENSE", description: "Push QA", amount: "129.90", scheduledDate: new Date(`${date}T00:00:00Z`), competenceDate: new Date("2040-10-01T00:00:00Z"), status } });
        if (i === 0 && status === "PENDING" && date === "2040-10-10") transactions.push(row.id);
      }
    }
    const selected = await db.transaction.findMany({ where: { ...dueExpenseWhere(now), createdBy: { in: users } }, select: { id: true } });
    assert.deepEqual(selected.map(t => t.id), transactions);
    // Scope the real job's reads to the isolated fixture; no provider calls or user data touched.
    const scoped = db.$extends({ query: { transaction: {
      async findMany({ args, query }) { args.where = { AND: [args.where ?? {}, { createdBy: { in: users } }] }; return query(args); },
      async findFirst({ args, query }) { args.where = { AND: [args.where ?? {}, { createdBy: { in: users } }] }; return query(args); },
    } } }) as unknown as PrismaClient;
    let sends = 0;
    const sender = async () => { sends++; };
    await Promise.all([sendDueNotifications(scoped, sender, now), sendDueNotifications(scoped, sender, now)]);
    await sendDueNotifications(scoped, sender, now);
    assert.equal(sends, 2);
    assert.equal(await db.notificationLog.count({ where: { userId: { in: users } } }), 1);
    assert.equal(await db.notificationDelivery.count({ where: { log: { userId: { in: users } }, status: "SENT" } }), 2);
    // A fresh date is a new notification identity; expired device does not block the other.
    await db.transaction.update({ where: { id: transactions[0] }, data: { scheduledDate: new Date("2040-10-12T00:00:00Z") } });
    const result = await sendDueNotifications(scoped, async s => { if (s.endpoint === subscription.endpoint) throw { statusCode: 410 }; }, new Date("2040-10-11T12:00:00Z"));
    assert.equal(result.expired, 1); assert.equal(result.sent, 1);
    assert.deepEqual(await a.status(subscriptionEndpoint()), { active: false });
  } finally {
    await db.transaction.deleteMany({ where: { createdBy: { in: users } } });
    await db.account.deleteMany({ where: { householdId: { in: homes } } });
    await db.category.deleteMany({ where: { householdId: { in: homes } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.household.deleteMany({ where: { id: { in: homes } } });
    await db.$disconnect();
  }
  function subscriptionEndpoint() { return { endpoint: subscription.endpoint }; }
});
