import "server-only";
import { requireApiUser } from "../auth/session";
import { prisma } from "../db/prisma";
import { AppError } from "./errors";
import { reportService } from "../../services/reports";
import type { MeasureReport } from "../finance/report-timing";
export async function reportsContext(measure?: MeasureReport) {
  const user = await requireApiUser();
  if (!user.membership) throw new AppError("NO_HOUSEHOLD", "Seu usuário não possui um espaço familiar.", 403);
  return reportService(prisma, { userId: user.id, householdId: user.membership.household.id }, new Date(), measure);
}
