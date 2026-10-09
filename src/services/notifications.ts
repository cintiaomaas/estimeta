import type { PrismaClient } from "@prisma/client";
import { AppError } from "../lib/api/errors";
export function notifications(db: PrismaClient, userId: string) {
  return {
    async list(page = 1, selected?: string) {
      const where = { userId };
      const [items, unread, total, selection] = await Promise.all([
        db.notificationLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }),
        db.notificationLog.count({ where: { userId, readAt: null } }),
        db.notificationLog.count({ where }),
        selected ? db.notificationLog.findFirst({ where: { id: selected, userId } }) : null,
      ]);
      return { items, unread, total, selection };
    },
    async read(id?: string) {
      const result = await db.notificationLog.updateMany({ where: { userId, ...(id ? { id } : {}), readAt: null }, data: { readAt: new Date() } });
      if (id && !result.count && !await db.notificationLog.findFirst({ where: { id, userId }, select: { id: true } })) throw new AppError("NOT_FOUND", "Notificação não encontrada.", 404);
      return { updated: result.count };
    },
  };
}
