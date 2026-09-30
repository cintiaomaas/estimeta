import { test } from "node:test";
import assert from "node:assert/strict";
import { AppError, handleApiError } from "../src/lib/api/errors";

test("erros esperados mantêm contrato/status e não permitem cache", async () => {
  const response = handleApiError(new AppError("NOT_FOUND", "Registro não encontrado neste espaço familiar.", 404));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { error: { code: "NOT_FOUND", message: "Registro não encontrado neste espaço familiar." } });
});

test("falha inesperada não expõe detalhes na resposta nem no log", async context => {
  const logs: string[] = [];
  context.mock.method(console, "error", (message: string) => logs.push(message));
  const response = handleApiError(new Error("mysql://private:secret@internal/db SELECT financial-data session-token"));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.error.code, "INTERNAL_ERROR");
  assert.equal(logs.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(logs[0])).sort(), ["event", "timestamp"]);
  assert.equal(JSON.parse(logs[0]).event, "api.unexpected_error");
  assert.doesNotMatch(JSON.stringify(body) + logs.join(), /secret|internal\/db|SELECT|financial-data|session-token|stack/);
});
