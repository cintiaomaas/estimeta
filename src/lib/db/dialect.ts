import { Prisma } from "@prisma/client";

// PostgreSQL is the only application provider. All values remain parameters.
export const sql = Prisma.sql;
export function enumParameter(value: string, type: "TransactionType" | "TransactionStatus") {
  return Prisma.sql`${value}::${Prisma.raw(`"${type}"`)}`;
}
export const searchOperator = () => Prisma.raw('COLLATE "estimeta_text_ci_ai" LIKE');
export const competenceYear = () => Prisma.sql`EXTRACT(YEAR FROM "competenceDate")::int`;
export const containsText = (value: string) => ({ contains: value, mode: "insensitive" as const });
