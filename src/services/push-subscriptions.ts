import { createHash, ECDH } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { AppError } from "../lib/api/errors";
import { pushEndpointSchema, pushSubscriptionSchema } from "../lib/validations/push";

export const endpointHash = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");
export function pushSubscriptions(db: PrismaClient, userId: string) {
  return {
    async save(input: unknown, session?: { sessionId: string; expiresAt: Date }) {
      const data = pushSubscriptionSchema.parse(input);
      if (!session || session.expiresAt <= new Date()) throw new AppError("UNAUTHORIZED", "Entre novamente para ativar os avisos.", 401);
      try { ECDH.convertKey(Buffer.from(data.keys.p256dh, "base64url"), "prime256v1"); }
      catch { throw new AppError("INVALID_INPUT", "Chave de push inválida.", 400); }
      const hash = endpointHash(data.endpoint);
      // updateMany's ownership predicate also protects against concurrent changes.
      const existing = await db.pushSubscription.findUnique({ where: { endpointHash: hash }, select: { userId: true } });
      if (existing && existing.userId !== userId) throw new AppError("CONFLICT", "Este navegador está vinculado a outra conta. Desative os avisos nela antes de ativar aqui.", 409);
      const values = { endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth, active: true, ...session };
      if (existing) await db.pushSubscription.updateMany({ where: { endpointHash: hash, userId }, data: values });
      else await db.pushSubscription.create({ data: { ...values, endpointHash: hash, userId } });
      return { active: true, userId, sessionId: session.sessionId, expiresAt: session.expiresAt.toISOString(), endpoint: data.endpoint };
    },
    async remove(input: unknown) {
      const { endpoint } = pushEndpointSchema.parse(input);
      await db.pushSubscription.updateMany({ where: { endpointHash: endpointHash(endpoint), userId }, data: { active: false } });
      return { active: false };
    },
    async status(input: unknown) {
      const { endpoint } = pushEndpointSchema.parse(input);
      const row = await db.pushSubscription.findFirst({ where: { endpointHash: endpointHash(endpoint), userId, active: true }, select: { id: true } });
      return { active: !!row };
    },
  };
}
