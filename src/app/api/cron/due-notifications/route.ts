import { apiError, handleApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { authorizedCron } from "@/lib/push/cron-auth";
import { createPushSender } from "@/lib/push/sender";
import { sendDueNotifications } from "@/services/due-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!authorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) return apiError("UNAUTHORIZED", "Acesso não autorizado.", 401);
  try {
    const result = await sendDueNotifications(prisma, createPushSender());
    console.info(JSON.stringify({ event: "push.job_completed", ...result }));
    return Response.json({ data: result }, { status: result.incomplete ? 503 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleApiError(error); }
}
