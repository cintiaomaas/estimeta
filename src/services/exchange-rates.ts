import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/api/errors";
import { todayInBrazil } from "../lib/finance/dates";
import { currencyCodes } from "../lib/finance/currencies";

export const exchangeSource = "Frankfurter · taxa de referência";
export function valuationDate(before: Date, today = todayInBrazil()) {
  const end = new Date(before.getTime() - 86400000).toISOString().slice(0, 10);
  return end < today ? end : today;
}
export function parseQuote(input: unknown, currency: string, requestedDate: string) {
  const row = input as { base?: string; quote?: string; date?: string; rate?: unknown };
  if (!row || row.base?.toUpperCase() !== currency || row.quote?.toUpperCase() !== "BRL" ||
      !row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || row.date > requestedDate || !Number.isFinite(Date.parse(`${row.date}T00:00:00Z`)) || new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10) !== row.date ||
      !["string", "number"].includes(typeof row.rate)) throw new Error("Cotação inválida.");
  const rate = new Prisma.Decimal(String(row.rate)).toDecimalPlaces(10);
  if (!rate.isFinite() || rate.lte(0) || rate.gte("100000000")) throw new Error("Cotação inválida.");
  return { rate: rate.toDecimalPlaces(10), referenceDate: row.date, source: exchangeSource };
}
const inflight = new Map<string, Promise<void>>();
// Network work happens before financial transactions. The database cache survives restarts.
export async function refreshQuote(db: PrismaClient, currency: string, requestedDate = todayInBrazil(), force = false) {
  if (currency === "BRL") return;
  if (!currencyCodes.includes(currency as typeof currencyCodes[number])) throw new Error("Moeda inválida.");
  const key = `${currency}:${requestedDate}`;
  const pending = inflight.get(key);
  if (pending) return pending;
  const work = (async () => {
    const cached = await db.exchangeRate.findUnique({ where: { currency_requestedDate: { currency, requestedDate } } });
    const today = todayInBrazil();
    // Historical snapshots are immutable; current-day quotes can be manually refreshed.
    if (cached && (!force || requestedDate < today)) return;
    try {
      const url = new URL(`https://api.frankfurter.dev/v2/rate/${currency}/BRL`);
      url.searchParams.set("date", requestedDate);
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error(`Exchange HTTP ${response.status}`);
      const quote = parseQuote(await response.json(), currency, requestedDate);
      await db.exchangeRate.upsert({ where: { currency_requestedDate: { currency, requestedDate } },
        create: { currency, requestedDate, ...quote }, update: { ...quote, checkedAt: new Date() } });
    } catch {
      // Keep previous observations. Readers report stale/missing data explicitly.
    }
  })();
  inflight.set(key, work);
  try { await work; } finally { inflight.delete(key); }
}
export async function prepareExchangeRates(db: PrismaClient, householdId: string, dates = [todayInBrazil()], force = false) {
  const accounts = await db.account.findMany({ where: { householdId, currency: { not: "BRL" } }, select: { currency: true } });
  const currencies = [...new Set(accounts.map(a => a.currency))];
  // Bound upstream concurrency, including annual reports.
  const jobs = [...new Set(dates)].flatMap(date => currencies.map(currency => ({ date, currency })));
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map(job => refreshQuote(db, job.currency, job.date, force)));
}
export async function readQuote(db: Prisma.TransactionClient, currency: string, requestedDate = todayInBrazil()) {
  if (currency === "BRL") return null;
  const row = await db.exchangeRate.findFirst({ where: { currency, requestedDate: { lte: requestedDate }, referenceDate: { lte: requestedDate } }, orderBy: { requestedDate: "desc" } });
  return row ? { rate: row.rate.toFixed(10), referenceDate: row.referenceDate, source: row.source,
    stale: row.requestedDate !== requestedDate, checkedAt: row.checkedAt.toISOString() } : null;
}
export async function movementMoney(tx: Prisma.TransactionClient, currency: string, value: string, previous?: { originalAmount?: Prisma.Decimal | null; amount: Prisma.Decimal; exchangeRate?: Prisma.Decimal | null } | null) {
  if (currency === "BRL") return { amount: new Prisma.Decimal(value), originalAmount: null, exchangeRate: null };
  // Editing descriptions/status must not reprice existing movements.
  if (previous?.originalAmount?.equals(value) && previous.exchangeRate) return { amount: previous.amount, originalAmount: previous.originalAmount, exchangeRate: previous.exchangeRate };
  const quote = await readQuote(tx, currency);
  if (!quote || quote.stale) throw new AppError("EXCHANGE_UNAVAILABLE", "Não foi possível atualizar a cotação. Tente novamente antes de salvar o lançamento.", 503);
  const originalAmount = new Prisma.Decimal(value), rate = new Prisma.Decimal(quote.rate);
  const amount = originalAmount.mul(rate).toDecimalPlaces(2);
  if (amount.gte("10000000000000") || originalAmount.lte(0)) throw new AppError("INVALID_INPUT", "Informe um valor positivo cujo equivalente em reais não exceda R$ 9.999.999.999.999,99.", 400);
  return { amount, originalAmount, exchangeRate: rate };
}
