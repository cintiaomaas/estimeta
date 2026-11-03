import { financialActor, financeError, financeResponse } from "@/lib/api/finance";
import { prisma } from "@/lib/db/prisma";
import { prepareExchangeRates, readQuote } from "@/services/exchange-rates";
import { todayInBrazil } from "@/lib/finance/dates";

export async function POST(request: Request) {
  try {
    const actor = await financialActor(request);
    await prepareExchangeRates(prisma, actor.householdId, [todayInBrazil()], true);
    const accounts = await prisma.account.findMany({ where: { householdId: actor.householdId, currency: { not: "BRL" } }, select: { currency: true } });
    const quotes = await Promise.all([...new Set(accounts.map(a => a.currency))].map(c => readQuote(prisma, c)));
    const incomplete = quotes.some(q => !q || q.stale);
    return financeResponse({ data: { message: incomplete ? "Não foi possível obter todas as cotações. As últimas disponíveis foram preservadas." : "Cotações consultadas. As datas de referência aparecem em cada conta." } });
  } catch (error) { return financeError(error); }
}
