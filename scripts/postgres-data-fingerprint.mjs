import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

// Only digests stay in memory; never print financial records, users or credentials.
export async function fingerprint() {
  const db = new PrismaClient();
  try {
    const tables = new Map();
    for (const model of Prisma.dmmf.datamodel.models) {
      const delegate = model.name[0].toLowerCase() + model.name.slice(1);
      const keys = model.primaryKey?.fields ?? model.fields.filter(field => field.isId).map(field => field.name);
      const rows = await db[delegate].findMany();
      tables.set(model.name, new Map(rows.map(row => [
        JSON.stringify(keys.map(key => row[key])),
        createHash("sha256").update(JSON.stringify(row)).digest("hex"),
      ])));
    }
    return tables;
  } finally { await db.$disconnect(); }
}

export function assertPreserved(before, after) {
  let count = 0;
  for (const [table, rows] of before) {
    for (const [key, digest] of rows) {
      if (after.get(table)?.get(key) !== digest) throw new Error(`Existing data changed: ${table}`);
      count++;
    }
    if (table !== "ExchangeRate" && after.get(table)?.size !== rows.size) throw new Error(`Fixture cleanup incomplete: ${table}`);
  }
  console.info(`Integrity: ${count} pre-existing records unchanged across ${before.size} tables.`);
}
