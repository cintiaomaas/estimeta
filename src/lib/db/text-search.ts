import { Prisma } from "@prisma/client";

// PostgreSQL 18 LIKE supports nondeterministic ICU collations, including accents.
// Table/column names are selected exclusively from this static application map.
const searchable = {
  RecurringTransaction: '"RecurringTransaction"', Transfer: '"Transfer"',
  FinancialGoal: '"FinancialGoal"', GoalParticipant: '"GoalParticipant"',
} as const;
export async function matchingTextIds(db: Prisma.TransactionClient, table: keyof typeof searchable, householdId: string, text: string) {
  const column = table === "FinancialGoal" || table === "GoalParticipant" ? '"name"' : '"description"';
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM ${Prisma.raw(searchable[table])}
    WHERE "householdId" = ${householdId}
      AND ${Prisma.raw(column)} COLLATE "estimeta_text_ci_ai" LIKE ${`%${text}%`}
  `);
  return { in: rows.map(row => row.id) };
}
