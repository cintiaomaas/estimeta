import { z } from "zod";
import { bankCodes } from "../finance/banks";

const name = z.string().trim().min(1, "Informe o nome.").max(100, "O nome deve ter até 100 caracteres.").transform((value) => value.replace(/\s+/g, " "));
export const transactionType = z.enum(["INCOME", "EXPENSE"]);
// No floating point conversion: decimal strings travel intact to Prisma Decimal.
const money = z.string().regex(/^\d{1,13}(\.\d{1,2})?$/, "Informe um valor positivo, com até 13 dígitos inteiros e 2 decimais (ex.: 120.50).");
export const financialDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.").refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return value >= "1000-01-01" && value <= "9999-12-31" && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Informe uma data válida.");
export const accountSchema = z.object({ name, bankCode: z.enum(bankCodes, { error: "Selecione uma instituição válida." }).nullable().optional(), type: z.enum(["CHECKING", "SAVINGS", "CASH", "INVESTMENT", "OTHER"]), initialBalance: money, includeInTotalBalance: z.boolean().default(true), isActive: z.boolean().default(true) }).strict();
export const categorySchema = z.object({ name, type: transactionType, isActive: z.boolean().default(true) }).strict();
export const transactionSchema = z.object({
  accountId: z.uuid("Selecione uma conta válida."), categoryId: z.uuid("Selecione uma categoria válida."),
  type: transactionType, description: z.string().trim().min(1, "Informe a descrição.").max(200),
  amount: money.refine((value) => /[1-9]/.test(value), "O valor deve ser maior que zero."),
  scheduledDate: financialDate, transactionDate: financialDate.nullable().default(null),
  competenceDate: financialDate.transform((value) => `${value.slice(0, 7)}-01`),
  status: z.enum(["PENDING", "RECEIVED", "PAID"]), notes: z.string().trim().max(2000).nullable().default(null),
}).strict().superRefine((data, ctx) => {
  if ((data.type === "INCOME" && data.status === "PAID") || (data.type === "EXPENSE" && data.status === "RECEIVED")) ctx.addIssue({ code: "custom", path: ["status"], message: "O status não corresponde ao tipo de lançamento." });
  if (data.status !== "PENDING" && !data.transactionDate) ctx.addIssue({ code: "custom", path: ["transactionDate"], message: "Informe a data efetiva do pagamento ou recebimento." });
  if (data.status === "PENDING" && data.transactionDate) ctx.addIssue({ code: "custom", path: ["transactionDate"], message: "Lançamentos previstos não possuem data efetiva." });
});
export const transactionFilterSchema = z.object({
  type: transactionType.optional(), status: z.enum(["PENDING", "RECEIVED", "PAID", "OVERDUE"]).optional(),
  accountId: z.uuid().optional(), categoryId: z.uuid().optional(),
  year: z.coerce.number().int().min(1000).max(9999).optional(), month: z.coerce.number().int().min(1).max(12).optional(),
  startDate: financialDate.optional(), endDate: financialDate.optional(), search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["date", "amount", "description"]).default("date"), order: z.enum(["asc", "desc"]).default("desc"),
}).strict().superRefine((data, ctx) => {
  if (data.month && !data.year) ctx.addIssue({ code: "custom", message: "Informe o ano ao filtrar por mês." });
  if (data.startDate && data.endDate && data.startDate > data.endDate) ctx.addIssue({ code: "custom", message: "A data inicial deve ser anterior à final." });
});
export const categoryFilterSchema = z.object({ type: transactionType.optional() }).strict();
export type TransactionInput = z.infer<typeof transactionSchema>;
export type TransactionFilters = z.infer<typeof transactionFilterSchema>;
