import { z } from "zod";
import { financialDate, transactionSchema, transactionFilterSchema } from "./finance";
export const goalStatus = z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]);
const optionalId = z.uuid().nullable().default(null);
export const participantSchema = z.object({ name: z.string().trim().min(1, "Informe o nome.").max(100).transform(v => v.replace(/\s+/g, " ")), isActive: z.boolean().default(true) }).strict();
export const goalSchema = z.object({
  name: participantSchema.shape.name, description: transactionSchema.shape.notes,
  icon: z.enum(["travel", "home", "reserve", "car", "study"]).nullable().default(null),
  targetAmount: transactionSchema.shape.amount, startDate: financialDate,
  targetDate: financialDate.nullable().default(null), accountId: optionalId,
  participants: z.array(participantSchema).max(50).default([]),
}).strict().refine(v => !v.targetDate || v.targetDate >= v.startDate, { path: ["targetDate"], message: "O prazo deve ser igual ou posterior ao início." });
export const goalStateSchema = z.object({ status: goalStatus }).strict();
export const contributionSchema = z.object({
  participantId: optionalId, accountId: optionalId, transferId: optionalId,
  amount: transactionSchema.shape.amount, contributionDate: financialDate,
  competenceDate: transactionSchema.shape.competenceDate, description: transactionSchema.shape.notes,
}).strict();
export const goalFilters = z.object({
  status: goalStatus.optional(), search: z.string().trim().max(100).optional(),
  participant: z.string().trim().max(100).optional(), accountId: z.uuid().optional(),
  deadline: z.enum(["NONE", "OVERDUE", "UPCOMING"]).optional(),
  through: financialDate.optional(), page: transactionFilterSchema.shape.page, limit: transactionFilterSchema.shape.limit,
}).strict();
export const goalPeriod = z.object({ through: financialDate.optional() }).strict();
