import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { banks, findBank } from "../src/lib/finance/banks";
import { accountSchema } from "../src/lib/validations/finance";

const account = { name: "Principal", type: "CHECKING", initialBalance: "120.59" };
test("cadastro aceita todas as instituições e mantém compatibilidade com contas antigas", () => {
  assert.equal(banks.length, 16);
  assert.equal(new Set(banks.map((bank) => bank.code)).size, banks.length);
  for (const bank of banks) {
    assert.equal(accountSchema.parse({ ...account, bankCode: bank.code }).bankCode, bank.code);
    if (bank.logo) assert.match(bank.logo, /^\/banks\/[A-Za-z0-9-]+\.(svg|png|jpg)$/);
  }
  assert.equal(accountSchema.parse(account).bankCode, undefined);
  assert.equal(accountSchema.parse({ ...account, bankCode: null }).bankCode, null);
  for (const bankCode of ["unknown", "", "https://example.com/logo.svg", 12]) {
    assert.equal(accountSchema.safeParse({ ...account, bankCode }).success, false);
  }
});
test("metadados locais distinguem instituições e fallbacks", () => {
  assert.equal(findBank("nubank")?.logo, "/banks/nubank.png");
  assert.equal(findBank("other")?.logo, null);
  for (const code of [undefined, null, "unknown"]) assert.equal(findBank(code), undefined);
});


test("serviço encaminha somente bankCode ao Prisma e preserva omissão na edição", async () => {
  const { Prisma } = await import("@prisma/client");
  const { financialService } = await import("../src/services/finance");
  const calls: Array<{ data: Record<string, unknown>; where?: Record<string, unknown> }> = [];
  const tx = { account: {
    findFirst: async () => ({ id: "account", bankCode: "nubank" }),
    create: async (args: typeof calls[number]) => { calls.push(args); return { ...args.data, initialBalance: new Prisma.Decimal("120.59") }; },
    update: async (args: typeof calls[number]) => { calls.push(args); return { ...args.data, initialBalance: new Prisma.Decimal("120.59") }; },
  } };
  const db = { $transaction: async (work: (value: typeof tx) => Promise<unknown>) => work(tx) };
  const service = financialService(db as unknown as import("@prisma/client").PrismaClient, { householdId: "family", userId: "user" });
  await service.saveAccount({ ...account, bankCode: "nubank" });
  assert.equal(calls[0].data.bankCode, "nubank");
  assert.equal(calls[0].data.householdId, "family");
  assert.equal("logo" in calls[0].data, false);
  await service.saveAccount({ ...account, bankCode: "viacredi" }, "account");
  assert.equal(calls[1].data.bankCode, "viacredi");
  assert.deepEqual(calls[1].where, { id: "account", householdId: "family" });
  await service.saveAccount(account, "account");
  assert.equal(Object.hasOwn(calls[2].data, "bankCode"), false);
  await service.saveAccount({ ...account, bankCode: null }, "account");
  assert.equal(calls[3].data.bankCode, null);
});

test("logos obtidos existem, mantêm o formato e correspondem aos originais registrados", () => {
  const sources = JSON.parse(readFileSync("public/banks/sources.json", "utf8")) as Array<{ code: string; file: string; sha256: string }>;
  assert.equal(sources.length, 11);
  for (const source of sources) {
    const bytes = readFileSync("public/banks/" + source.file);
    assert.equal(findBank(source.code)?.logo, "/banks/" + source.file);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256);
    if (source.file.endsWith(".png")) assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    else if (source.file.endsWith(".jpg")) assert.equal(bytes.subarray(0, 3).toString("hex"), "ffd8ff");
    else {
      const svg = bytes.toString("utf8");
      assert.match(svg, /<svg[ >]/);
      assert.doesNotMatch(svg, /<script|<foreignObject|\son[a-z]+\s*=|(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i);
    }
  }
});
