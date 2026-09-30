import type { PrismaClient } from "@prisma/client";
import { defaultCategories } from "../lib/finance/defaults";

/** Marker prevents restoring categories deliberately renamed or deleted after initialization. */
export async function initializeFinancialDefaults(db: PrismaClient, onlyHouseholds?: string[]) {
  const households = await db.household.findMany({ where: { financialDefaultsAt: null, ...(onlyHouseholds ? { id: { in: onlyHouseholds } } : {}) }, select: { id: true } });
  let initialized = 0;
  for (const household of households) {
    initialized += await db.$transaction(async (tx) => {
      const claimed = await tx.household.updateMany({ where: { id: household.id, financialDefaultsAt: null }, data: { financialDefaultsAt: new Date() } });
      if (!claimed.count) return 0;
      await tx.category.createMany({ data: defaultCategories.map((category) => ({ ...category, householdId: household.id })), skipDuplicates: true });
      return 1;
    });
  }
  return initialized;
}
