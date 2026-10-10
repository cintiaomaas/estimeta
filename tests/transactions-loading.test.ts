import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TransactionsManager } from "../src/components/finance/transactions-manager";
import { CatalogProvider } from "../src/components/finance/catalog-provider";

test("transactions render before catalogs, survive catalog failure, and paginate without reloading catalogs", async () => {
  const dom = new JSDOM("<div id='root'></div>", { url: "http://localhost" });
  const calls: string[] = [];
  const pending = new Map<string, (value: unknown) => void>();
  const globals = { self: dom.window, window: dom.window, document: dom.window.document,
    Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string) => { calls.push(url); return new Promise(resolve => pending.set(url, resolve)); } };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const root = createRoot(dom.window.document.getElementById("root")!);
  const container = dom.window.document.getElementById("root")!;
  const router = { bfcacheId: "test", back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, hmrRefresh() {} };
  const respond = async (url: string, data: unknown, ok = true) => act(async () => {
    const resolve = pending.get(url); assert.ok(resolve, url); pending.delete(url);
    resolve({ ok, json: async () => data });
  });
  const result = (description: string, page: number) => ({ data: [{ id: "t1", description, type: "EXPENSE", amount: "10.00", status: "PENDING", displayStatus: "PENDING", accountId: "a", categoryId: "c", scheduledDate: "2026-10-10", competenceDate: "2026-10-01", transactionDate: null, notes: null, account: { id: "a", name: "Conta", isActive: true }, category: { id: "c", name: "Categoria", isActive: true } }], pagination: { page, totalPages: 2, total: 2, limit: 1 } });
  try {
    await act(async () => root.render(createElement(AppRouterContext.Provider, { value: router },
      createElement(CatalogProvider, null, createElement(TransactionsManager, { initialPeriod: "2026-10-01" })))));
    const transactions = calls.find(url => url.startsWith("/api/transactions"))!;
    await respond(transactions, result("Primeiro lançamento", 1));
    assert.match(container.textContent!, /Primeiro lançamento/);
    assert.equal(container.querySelector<HTMLSelectElement>("#filter-category")!.disabled, true);
    await respond("/api/accounts", { data: [] });
    await respond("/api/categories", { error: { message: "indisponível" } }, false);
    assert.match(container.textContent!, /Primeiro lançamento/);
    assert.match(container.textContent!, /Não foi possível carregar contas e categorias/);
    await act(async () => [...container.querySelectorAll("button")].find(b => b.textContent === "Tentar carregar opções")!.click());
    await respond("/api/accounts", { data: [] });
    await respond("/api/categories", { data: [] });
    const catalogCalls = calls.filter(url => url === "/api/accounts" || url === "/api/categories").length;
    await act(async () => [...container.querySelectorAll("button")].find(b => b.textContent === "Próxima")!.click());
    await respond(calls.filter(url => url.startsWith("/api/transactions")).at(-1)!, result("Segundo lançamento", 2));
    assert.match(container.textContent!, /Segundo lançamento/);
    assert.equal(calls.filter(url => url === "/api/accounts" || url === "/api/categories").length, catalogCalls);
    await act(async () => window.dispatchEvent(new Event("financial-catalogs-changed")));
    assert.equal(calls.filter(url => url === "/api/accounts" || url === "/api/categories").length, catalogCalls + 2);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
