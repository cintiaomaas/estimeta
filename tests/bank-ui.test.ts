import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { BankIdentity, BankSelect } from "../src/components/finance/bank-identity";

test("seletor e logos: edição, contas antigas, Outro, erro e troca de instituição", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "http://localhost" });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  try {
    await act(async () => { root.render(createElement("form", null, createElement(BankSelect, { defaultValue: "viacredi" }))); });
    const select = container.querySelector("select")!;
    assert.equal(select.value, "viacredi");
    assert.equal(select.labels?.[0].textContent, "Banco / Instituição financeira");
    assert.equal(select.options.length, 17);
    await act(async () => { select.value = "nubank"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    assert.equal(new dom.window.FormData(container.querySelector("form")!).get("bankCode"), "nubank");
    const img = container.querySelector("img")!;
    assert.equal(new URL(img.src).pathname, "/banks/nubank.png");
    assert.equal(img.alt, "Nubank");
    Object.defineProperty(img, "naturalWidth", { value: 32 });
    await act(async () => { img.dispatchEvent(new dom.window.Event("load")); });
    assert.equal(img.style.opacity, "1");
    assert.equal(container.querySelector("svg"), null);
    await act(async () => { img.dispatchEvent(new dom.window.Event("error")); });
    assert.equal(container.querySelector("img"), null);
    assert.ok(container.querySelector("svg"));
    await act(async () => { select.value = "itau"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    assert.equal(new URL(container.querySelector("img")!.src).pathname, "/banks/itau.png");
    for (const bankCode of [undefined, null, "unknown", "other"]) {
      await act(async () => { root.render(createElement(BankIdentity, { bankCode })); });
      assert.equal(container.querySelector("img"), null);
      assert.equal(container.querySelector("svg")?.getAttribute("aria-hidden"), "true");
      assert.match(container.textContent!, bankCode === "other" ? /Outro/ : /Instituição não informada/);
    }
    await act(async () => { root.render(createElement(BankSelect)); });
    assert.equal(container.querySelector("select")?.value, "");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
