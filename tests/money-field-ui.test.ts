import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement, act, useState } from "react";
import { MoneyField } from "../src/components/finance/money-field";

test("campo monetário: teclado decimal, digitação, blur e reabertura para edição", async () => {
  const dom = new JSDOM("<div id='root'></div>", { url: "http://localhost" });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const { createRoot } = await import("react-dom/client");
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  let saved = "";
  function Form({ initial }: { initial: string }) {
    const [value, setValue] = useState(initial);
    return createElement("form", null, createElement(MoneyField, { id: "amount", label: "Valor (R$)", name: "amount", value, onValueChange: next => { saved = next; setValue(next); } }));
  }
  try {
    for (const initial of ["", "5300.00"]) {
      await act(async () => root.render(createElement(Form, { key: initial, initial })));
      const input = container.querySelector<HTMLInputElement>("#amount")!;
      assert.equal(input.type, "text");
      assert.equal(input.inputMode, "decimal");
      if (initial) assert.equal(input.value, "5.300,00");
      for (const raw of ["5300,00", "5300.00", "5.300,00", "5300", "5300, 00"]) {
        await act(async () => {
          Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, raw);
          input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        });
        assert.equal(saved, "5300.00");
        assert.equal(new dom.window.FormData(container.querySelector("form")!).get("amount"), "5300.00");
        await act(async () => input.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true })));
        assert.equal(input.value, "5.300,00");
      }
    }
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
