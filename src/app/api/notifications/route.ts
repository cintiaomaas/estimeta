import { z } from "zod";
import { financialActor, financeError, financeResponse, readJson } from "@/lib/api/finance";
import { prisma } from "@/lib/db/prisma";
import { notifications } from "@/services/notifications";
export async function GET(request: Request) {
  try {
    const { userId } = await financialActor(request);
    const params = new URL(request.url).searchParams;
    const page = z.coerce.number().int().min(1).max(100000).parse(params.get("page") ?? 1);
    const selected = z.string().uuid().optional().parse(params.get("selected") ?? undefined);
    return financeResponse({ data: await notifications(prisma, userId).list(page, selected) });
  } catch (error) { return financeError(error); }
}
export async function PATCH(request: Request) {
  try {
    const { userId } = await financialActor(request);
    const input = z.union([z.object({ id: z.string().uuid() }).strict(), z.object({ all: z.literal(true) }).strict()]).parse(await readJson(request));
    return financeResponse({ data: await notifications(prisma, userId).read("id" in input ? input.id : undefined) });
  } catch (error) { return financeError(error); }
}
