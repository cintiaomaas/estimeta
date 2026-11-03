import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { AdvancedList } from "../src/components/finance/advanced-list";
import type { AdvancedRecord } from "../src/components/finance/advanced-forms";

test("active and inactive recurrences offer deletion on desktop and mobile independently of toggle", async () => {
  const dom = new JSDOM("<div id='root'></div>", { url: "http://localhost" });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const root = createRoot(document.getElementById("root")!);
  const deleted: string[] = [];
  const row = { id: "active", description: "Internet", amount: "100.00", type: "EXPENSE", account: { name: "Conta" }, category: { name: "Casa" }, dayOfMonth: 10, isActive: true } as AdvancedRecord;
  try {
    await act(async () => root.render(createElement(AdvancedList, {
      rows: [row, { ...row, id: "inactive", isActive: false }], recurring: true,
      onDelete: (record: AdvancedRecord) => { deleted.push(record.id); },
      onDetails() { assert.fail("must not open details"); }, onToggle() { assert.fail("must not toggle"); }, onEdit() {}, onGenerate() {},
    })));
    for (const layout of [".ledger-desktop", ".ledger-mobile"]) {
      for (const trigger of document.querySelectorAll<HTMLButtonElement>(`${layout} .icon-button`)) {
        await act(async () => trigger.click());
        const action = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(button => button.textContent === "Excluir");
        assert.ok(action);
        await act(async () => action.click());
      }
    }
    assert.deepEqual(deleted, ["active", "inactive", "active", "inactive"]);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
