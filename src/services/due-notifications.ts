import { Prisma, type PrismaClient, type PushSubscription } from "@prisma/client";
import { tomorrowInBrazil } from "../lib/push/due-date";
import { dateOnly, displayDate } from "../lib/finance/dates";
import { currency } from "../lib/finance/client";

export const DUE_NOTIFICATION = "EXPENSE_DUE_TOMORROW";
export type PushMessage = { title: string; body: string; url: string; tag: string; userId: string };
export type PushSender = (subscription: PushSubscription, message: PushMessage) => Promise<unknown>;
const duplicate = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
export function dueExpenseWhere(now: Date): Prisma.TransactionWhereInput {
  return { type: "EXPENSE", status: "PENDING", scheduledDate: tomorrowInBrazil(now), creator: { pushSubscriptions: { some: { active: true } } } };
}

export async function sendDueNotifications(db: PrismaClient, send: PushSender, now = new Date(), budgetMs = 45_000) {
  const started = Date.now();
  const counts = { selected: 0, sent: 0, skipped: 0, failed: 0, expired: 0, incomplete: false };
  let cursor: string | undefined;
  while (Date.now() - started < budgetMs) {
    const expenses = await db.transaction.findMany({
      where: dueExpenseWhere(now), orderBy: { id: "asc" }, take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, createdBy: true, householdId: true },
    });
    if (!expenses.length) return counts;
    for (const candidate of expenses) {
      if (Date.now() - started >= budgetMs) { counts.incomplete = true; return counts; }
      cursor = candidate.id;
      // Re-read to exclude payments/deletions and household changes since selection.
      const expense = await db.transaction.findFirst({
        where: { ...dueExpenseWhere(now), id: candidate.id, creator: { membership: { householdId: candidate.householdId }, pushSubscriptions: { some: { active: true } } } },
        select: { id: true, createdBy: true, description: true, amount: true, scheduledDate: true, competenceDate: true },
      });
      if (!expense) continue;
      counts.selected++;
      const identity = { userId: expense.createdBy, transactionId: expense.id, type: DUE_NOTIFICATION, referenceDate: expense.scheduledDate };
      let log;
      try { log = await db.notificationLog.upsert({ where: { userId_transactionId_type_referenceDate: identity }, create: identity, update: {} }); }
      catch (error) {
        if (!duplicate(error)) throw error;
        log = await db.notificationLog.findUniqueOrThrow({ where: { userId_transactionId_type_referenceDate: identity } });
      }
      const subscriptions = await db.pushSubscription.findMany({ where: { userId: expense.createdBy, active: true } });
      // Bounded fan-out avoids one slow browser preventing all other devices.
      for (let i = 0; i < subscriptions.length; i += 5) {
        if (Date.now() - started >= budgetMs) { counts.incomplete = true; return counts; }
        await Promise.all(subscriptions.slice(i, i + 5).map(async subscription => {
          let delivery;
          try {
            delivery = await db.notificationDelivery.create({ data: { logId: log.id, endpointHash: subscription.endpointHash } });
          } catch (error) {
            if (!duplicate(error)) throw error;
            counts.skipped++; return;
          }
          const message: PushMessage = {
            title: "Conta vencendo amanhã",
            body: `${expense.description} — ${currency(expense.amount.toFixed(2))}\nVencimento: ${displayDate(dateOnly(expense.scheduledDate))}`,
            url: `/despesas?period=${dateOnly(expense.competenceDate).slice(0, 7)}`,
            tag: `${DUE_NOTIFICATION}:${expense.id}:${dateOnly(expense.scheduledDate)}`,
            userId: expense.createdBy,
          };
          try { await send(subscription, message); }
          catch (error) {
            const status = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : undefined;
            const expired = status === 404 || status === 410;
            if (expired) {
              await db.pushSubscription.updateMany({ where: { id: subscription.id, userId: subscription.userId, updatedAt: subscription.updatedAt }, data: { active: false } });
              counts.expired++;
            } else counts.failed++;
            await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: expired ? "EXPIRED" : "FAILED" } });
            return;
          }
          const sentAt = new Date();
          // A crash here leaves CLAIMED, deliberately preventing a duplicate send.
          await db.$transaction([
            db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "SENT", sentAt } }),
            db.notificationLog.updateMany({ where: { id: log.id, sentAt: null }, data: { sentAt } }),
          ]);
          counts.sent++;
        }));
      }
      if (counts.failed || counts.expired) {
        // Counts only: no endpoint, key, payload, provider response or financial data.
        console.warn(JSON.stringify({ event: "push.delivery_failures", failed: counts.failed, expired: counts.expired }));
      }
    }
    if (expenses.length < 100) return counts;
  }
  counts.incomplete = true;
  return counts;
}
