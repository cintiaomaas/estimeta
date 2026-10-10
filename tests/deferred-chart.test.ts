import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { DeferredChart } from "../src/components/ui/deferred-chart";

test("charts mount only near the viewport and disconnect the observer", async () => {
  const dom = new JSDOM("<div id='root'></div>");
  let notify!: (entries: { isIntersecting: boolean }[]) => void;
  let disconnected = 0;
  class Observer {
    constructor(callback: typeof notify, options: IntersectionObserverInit) {
      notify = callback;
      assert.equal(options.rootMargin, "200px");
    }
    observe() {}
    disconnect() { disconnected++; }
  }
  Object.defineProperty(dom.window, "IntersectionObserver", { value: Observer });
  const globals = { window: dom.window, document: dom.window.document, IntersectionObserver: Observer, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(DeferredChart, null, createElement("canvas"))));
    assert.equal(container.querySelector("canvas"), null);
    await act(async () => notify([{ isIntersecting: false }]));
    assert.equal(container.querySelector("canvas"), null);
    await act(async () => notify([{ isIntersecting: true }]));
    assert.ok(container.querySelector("canvas"));
    assert.equal(disconnected, 1);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
