import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma, PrismaClient } from "@prisma/client";
import { sql, enumParameter, competenceYear, searchOperator, containsText } from "../src/lib/db/dialect";
import { financialService } from "../src/services/finance";
import { accountBalances } from "../src/services/balances";
import { planningConfig } from "../src/services/planning";
import { atomic } from "../src/services/atomic";

async function postgres(work: () => Promise<void> | void) {
  const previous = process.env.ESTIMETA_DATABASE_PROVIDER;
  process.env.ESTIMETA_DATABASE_PROVIDER = "postgresql";
  try { await work(); } finally {
    if (previous === undefined) delete process.env.ESTIMETA_DATABASE_PROVIDER;
    else process.env.ESTIMETA_DATABASE_PROVIDER = previous;
  }
}
test("PostgreSQL parameters, enums, year, aliases and case-insensitive filters", () => postgres(() => {
  const attack = `x' OR true; DELETE FROM "User"; --`;
  const query = sql`SELECT ${competenceYear()} AS year FROM "Transaction" t WHERE t."type" = ${enumParameter("EXPENSE", "TransactionType")} AND t."description" ${searchOperator()} ${attack}`;
  assert.match(query.text, /EXTRACT\(YEAR FROM "competenceDate"\)::int/);
  assert.match(query.text, /\$1::"TransactionType"/);
  assert.match(query.text, /LIKE \$2/);
  assert.deepEqual(query.values, ["EXPENSE", attack]);
  assert.ok(!query.text.includes(attack));
  assert.deepEqual(containsText("ÁGUA"), { contains: "ÁGUA", mode: "insensitive" });
}));
test("PostgreSQL finance page keeps enum casts, bigint counts, scope and pagination", () => postgres(async () => {
  const queries: Prisma.Sql[] = [];
  const tx = { $queryRaw: async (query: Prisma.Sql) => { queries.push(query); return queries.length === 1 ? [{ total: 0n }] : []; } };
  const db = { $transaction: async (work: (value: unknown) => unknown) => work(tx) } as unknown as PrismaClient;
  const result = await financialService(db, { userId: "user", householdId: "home" }).transactions({ type: "EXPENSE", status: "PAID", search: "ÁGUA", page: 2, limit: 20 });
  assert.equal(result.pagination.total, 0);
  assert.equal(queries.length, 2);
  for (const q of queries) {
    assert.match(q.text, /FROM "Transaction"/);
    assert.match(q.text, /::"TransactionType"/);
    assert.match(q.text, /::"TransactionStatus"/);
    assert.match(q.text, /LIKE/);
    assert.ok(q.values.includes("home"));
  }
  assert.match(queries[1].text, /AS "accountName"/);
  assert.deepEqual(queries[1].values.slice(-2), [20, 20]);
}));
test("PostgreSQL balance and planning projections quote case-sensitive identifiers", () => postgres(async () => {
  const queries: Prisma.Sql[] = [];
  const tx = { $queryRaw: async (q: Prisma.Sql) => { queries.push(q); return []; } } as unknown as Prisma.TransactionClient;
  await accountBalances(tx, "home", new Date("2026-12-01T00:00:00Z"));
  await planningConfig(tx, "home");
  assert.match(queries[0].text, /FROM "Account"/);
  assert.match(queries[0].text, /FROM "Transaction"/);
  assert.match(queries[0].text, /FROM "Transfer"/);
  assert.match(queries[1].text, /FROM "IncomePlanning"/);
  assert.match(queries[1].text, /AS "groupId"/);
}));
test("provider error classes preserve Serializable retries and propagate non-retryable errors", async () => {
  for (const code of ["P2034", "P2002"]) {
    let attempts = 0;
    const db = { $transaction: async (_work: unknown, options: unknown) => {
      assert.deepEqual(options, { isolationLevel: "Serializable", timeout: 20000 });
      if (++attempts < 3) throw new Prisma.PrismaClientKnownRequestError("synthetic conflict", { code, clientVersion: Prisma.prismaVersion.client });
      return "committed-mock";
    } } as unknown as PrismaClient;
    assert.equal(await atomic(db, async () => "unused"), "committed-mock");
    assert.equal(attempts, 3);
  }
  let attempts = 0;
  const failure = new Prisma.PrismaClientKnownRequestError("synthetic FK failure", { code: "P2003", clientVersion: Prisma.prismaVersion.client });
  const db = { $transaction: async () => { attempts++; throw failure; } } as unknown as PrismaClient;
  await assert.rejects(atomic(db, async () => undefined), error => error === failure);
  assert.equal(attempts, 1);
});
