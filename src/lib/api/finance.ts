import "server-only";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { financialService } from "@/services/finance";
import { apiError, AppError, handleApiError } from "./errors";

export async function financialActor(request: Request) {
  // Cookie-authenticated mutations must originate from this application.
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new AppError("FORBIDDEN", "Origem da solicitação não permitida.", 403);
  }
  const user = await requireApiUser();
  if (!user.membership) throw new AppError("NO_HOUSEHOLD", "Seu usuário não possui um espaço familiar.", 403);
  return { userId: user.id, householdId: user.membership.household.id };
}
export async function financeContext(request: Request) {
  return financialService(prisma, await financialActor(request));
}
export async function readJson(request: Request) {
  try { return await request.json(); }
  catch { throw new AppError("INVALID_INPUT", "Envie um JSON válido.", 400); }
}
export function financeError(error: unknown) {
  if (error instanceof ZodError) return apiError("INVALID_INPUT", error.issues[0]?.message ?? "Revise os dados informados.", 400);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return apiError("DUPLICATE_RECORD", "Já existe um registro com esse nome e tipo neste espaço familiar.", 409);
    if (["P2003", "P2034"].includes(error.code)) return apiError("CONFLICT", "O registro está em uso ou foi alterado. Atualize a página e tente novamente.", 409);
    if (error.code === "P2025") return apiError("NOT_FOUND", "Registro não encontrado neste espaço familiar.", 404);
  }
  return handleApiError(error);
}
export function financeResponse(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
