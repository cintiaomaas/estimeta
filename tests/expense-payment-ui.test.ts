import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { TransactionList } from "../src/components/finance/transaction-list";
import type { TransactionRecord } from "../src/lib/finance/client";

test("desktop and mobile offer payment only for pending expenses without opening details", async () => {
  const dom = new JSDOM("<div id='root'></div>", { url: "http://localhost" });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const root = createRoot(document.getElementById("root")!);
  const base = { id: "pending", type: "EXPENSE", description: "Internet", amount: "100.00", status: "PENDING", displayStatus: "OVERDUE", scheduledDate: "2026-01-01", competenceDate: "2026-01-01", transactionDate: null, accountId: "a", categoryId: "c", notes: null, account: { id: "a", name: "Conta", isActive: true }, category: { id: "c", name: "Casa", isActive: true } } satisfies TransactionRecord;
  const rows: TransactionRecord[] = [base, { ...base, id: "paid", status: "PAID", displayStatus: "PAID" }, { ...base, id: "income", type: "INCOME" }];
  const paid: string[] = [];
  const props = { rows, paymentBusy: false, onPay: (row: TransactionRecord) => { paid.push(row.id); }, onEdit() {}, onDelete() {}, onRepeat() {} };
  try {
    await act(async () => root.render(createElement(TransactionList, props)));
    assert.equal(document.querySelector(".quick-payment"), null);
    const paymentAction = () => [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(button => button.textContent === "Marcar como pago");
    for (const layout of [".ledger-desktop", ".ledger-mobile"]) {
      const triggers = [...document.querySelectorAll<HTMLButtonElement>(`${layout} .icon-button`)];
      for (const [index, trigger] of triggers.entries()) {
        await act(async () => trigger.click());
        if (index === 0) {
          assert.ok(paymentAction());
          await act(async () => paymentAction()!.click());
        } else {
          assert.equal(paymentAction(), undefined);
          await act(async () => trigger.click());
        }
      }
    }
    assert.deepEqual(paid, ["pending", "pending"]);
    assert.equal(document.querySelector("dialog"), null);
    await act(async () => root.render(createElement(TransactionList, { ...props, paymentBusy: true })));
    for (const layout of [".ledger-desktop", ".ledger-mobile"]) {
      const trigger = document.querySelector<HTMLButtonElement>(`${layout} .icon-button`)!;
      await act(async () => trigger.click());
      assert.equal(paymentAction(), undefined);
      await act(async () => trigger.click());
    }
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
