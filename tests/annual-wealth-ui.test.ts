import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { ReportView } from "../src/components/reports/report-view";

test("resumo anual mantém indicadores, carregamento, erro e atualização do patrimônio", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "http://localhost" });
  let finish: (response: unknown) => void = () => {};
  const globals = { self: dom.window, window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: () => new Promise(resolve => { finish = resolve; }) };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  const data = (totalWealth: string) => ({ totalWealth, year: 2026, averageMonths: 10, availableYears: [2026],
    annualTotals: { income: "100.00", expenses: "20.00", netSavings: "80.00", balance: "80.00" },
    averages: { income: "10.00", expenses: "2.00", netSavings: "8.00" }, monthlySummary: [], incomeCategories: [], expenseCategories: [] });
  const respond = async (totalWealth: string) => act(async () => { finish({ ok: true, json: async () => ({ data: data(totalWealth) }) }); });
  const refresh = async () => act(async () => { container.querySelector<HTMLButtonElement>(".report-period button")!.click(); });
  try {
    await act(async () => { root.render(createElement(ReportView, { annual: true })); });
    assert.match(container.querySelector('[role="status"]')!.textContent!, /Carregando/);
    await act(async () => { finish({ ok: false, json: async () => ({ error: { message: "Falha de leitura" } }) }); });
    assert.ok(container.querySelector('[role="alert"]'));
    assert.equal(container.querySelectorAll(".summary-card").length, 0);
    await act(async () => { [...container.querySelectorAll("button")].find(b => b.textContent === "Tentar novamente")!.click(); });
    await respond("23000.00");
    assert.equal(container.querySelectorAll(".report-metrics .summary-card").length, 5);
    const cards = [...container.querySelectorAll(".summary-card")];
    assert.deepEqual(cards.slice(0, 4).map(c => c.querySelector("strong")!.textContent), ["R$ 100,00", "R$ 20,00", "R$ 80,00", "R$ 80,00"]);
    assert.match(cards[4].textContent!, /Patrimônio TotalR\$ 23.000,00Todas as contas \+ investimentos/);
    assert.equal(container.querySelectorAll(".panel h2").length, 3);
    for (const [value, formatted] of [["0.00", "R$ 0,00"], ["-900.00", "-R$ 900,00"]]) {
      await refresh(); await respond(value);
      assert.equal(container.querySelectorAll(".summary-card strong")[4].textContent, formatted);
    }
    await refresh();
    await act(async () => { finish({ ok: false, json: async () => ({ error: { message: "Falha de leitura" } }) }); });
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /Não foi possível atualizar/);
    assert.equal(container.querySelectorAll(".summary-card strong")[4].textContent, "-R$ 900,00");
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
