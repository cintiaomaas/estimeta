import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { NotificationCenter } from "../src/components/notifications/notification-center";
import { NotificationBell } from "../src/components/notifications/notification-bell";

test("central não lê automaticamente, ações atualizam badge e seleção do Push lê só o aviso", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "http://localhost" });
  const id = "11111111-1111-4111-8111-111111111111";
  let readAt: string | null = null;
  let patches = 0;
  const globals = { self: dom.window, window: dom.window, document: dom.window.document, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true, fetch: async (_url: string, options?: RequestInit) => {
    if (options?.method === "PATCH") { patches++; readAt = new Date().toISOString(); }
    const notice = { id, description: "Internet", amount: "129.9", referenceDate: "2026-10-10T00:00:00Z", competenceDate: "2026-10-01T00:00:00Z", transactionId: id, createdAt: "2026-10-09T12:00:00Z", readAt };
    return { ok: true, json: async () => ({ data: { items: [notice], unread: readAt ? 0 : 1, total: 1, selection: notice } }) };
  } };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  const render = (selected?: string) => createElement("div", null, createElement(NotificationBell), createElement(NotificationCenter, { selected }));
  try {
    await act(async () => { root.render(render()); });
    assert.equal(patches, 0);
    assert.match(container.textContent!, /Internet/);
    assert.match(container.textContent!, /R\$ 129,90/);
    assert.equal(container.querySelector(".notification-bell span")?.textContent, "1");
    assert.equal(container.querySelectorAll(".notification-card.unread").length, 1);
    const all = [...container.querySelectorAll("button")].find(b => b.textContent === "Marcar todas como lidas")!;
    await act(async () => { all.click(); });
    assert.equal(patches, 1);
    assert.equal(container.querySelector(".notification-bell span"), null);
    assert.equal(container.querySelectorAll(".notification-card.unread").length, 0);
    readAt = null;
    await act(async () => { root.render(render(id)); });
    assert.equal(patches, 2);
    assert.equal(container.querySelectorAll(".notification-card.selected").length, 1);
    assert.match(container.querySelector(".notification-actions a")!.getAttribute("href")!, /selected=11111111/);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
