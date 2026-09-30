import { z } from "zod";
import { financialDate, transactionSchema, transactionFilterSchema } from "./finance";
import { addMonthsClamped } from "../finance/months";

export const installmentSchema = transactionSchema.safeExtend({ type: z.literal("EXPENSE"), status: z.literal("PENDING"), transactionDate: z.null().default(null), installmentCount: z.coerce.number().int("Informe a quantidade de parcelas.").min(2).max(360) }).superRefine((data, ctx) => {
  const [whole, fraction = ""] = data.amount.split(".");
  if (/^\d+$/.test(whole) && /^\d{0,2}$/.test(fraction) && BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")) < BigInt(data.installmentCount)) ctx.addIssue({ code: "custom", path: ["amount"], message: "Cada parcela deve ter pelo menos R$ 0,01." });
  try { addMonthsClamped(data.competenceDate, data.installmentCount - 1); addMonthsClamped(data.scheduledDate, data.installmentCount - 1); }
  catch { ctx.addIssue({ code: "custom", path: ["competenceDate"], message: "As parcelas ultrapassam o ano máximo permitido." }); }
});
export const recurringSchema = z.object({
  type: transactionSchema.shape.type, description: transactionSchema.shape.description,
  amount: transactionSchema.shape.amount, accountId: transactionSchema.shape.accountId, categoryId: transactionSchema.shape.categoryId,
  notes: transactionSchema.shape.notes, frequency: z.literal("MONTHLY").default("MONTHLY"),
  startDate: financialDate, endDate: financialDate.nullable().default(null),
  dayOfMonth: z.coerce.number().int().min(1, "Informe um dia de 1 a 31.").max(31, "Informe um dia de 1 a 31."),
  isActive: z.boolean().default(true), revision: z.number().int().nonnegative().default(0),
}).strict().refine((data) => !data.endDate || data.endDate >= data.startDate, { path: ["endDate"], message: "O término deve ser igual ou posterior ao início." });
export const generationSchema = z.object({ competenceDate: transactionSchema.shape.competenceDate }).strict();
export const transferSchema = z.object({
  sourceAccountId: z.uuid("Selecione a conta de origem."), destinationAccountId: z.uuid("Selecione a conta de destino."),
  amount: transactionSchema.shape.amount, transferDate: financialDate, competenceDate: transactionSchema.shape.competenceDate,
  description: z.string().trim().max(200).default(""), notes: transactionSchema.shape.notes,
}).strict().refine((data) => data.sourceAccountId !== data.destinationAccountId, { path: ["destinationAccountId"], message: "As contas de origem e destino devem ser diferentes." });
export const advancedFilters = z.object({ year: transactionFilterSchema.shape.year, month: transactionFilterSchema.shape.month, accountId: transactionFilterSchema.shape.accountId, search: transactionFilterSchema.shape.search, page: transactionFilterSchema.shape.page, limit: transactionFilterSchema.shape.limit }).strict().refine((data) => !data.month || !!data.year, "Informe o ano ao filtrar por mês.");
