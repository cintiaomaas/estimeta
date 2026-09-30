import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSchema, registerFormSchema, passwordSchema } from "../src/lib/validations/auth";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";

const valid = { name: "Pessoa Exemplo", email: "EXEMPLO@example.com", password: "ExemploSeguro123" };
test("cadastro normaliza e-mail e remove campos não permitidos", () => {
  const result = registerSchema.parse({ ...valid, name: "  Pessoa Exemplo  ", role: "OWNER", userId: "injetado" });
  assert.equal(result.email, "exemplo@example.com");
  assert.equal(result.name, "Pessoa Exemplo");
  assert.equal("role" in result, false);
  assert.equal("userId" in result, false);
});
test("rejeita senhas fracas e senhas além do limite de bytes do bcrypt", () => {
  for (const password of ["1234567890", "abcdefghij", "Ab1", "á".repeat(36) + "1"]) assert.equal(passwordSchema.safeParse(password).success, false);
});
test("confirmação deve corresponder à senha", () => {
  assert.equal(registerFormSchema.safeParse({ ...valid, confirmPassword: "OutraSenha123" }).success, false);
  assert.equal(registerFormSchema.safeParse({ ...valid, confirmPassword: valid.password }).success, true);
});
test("hash tem salt e não aceita senha incorreta", async () => {
  const first = await hashPassword(valid.password);
  const second = await hashPassword(valid.password);
  assert.notEqual(first, valid.password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(valid.password, first), true);
  assert.equal(await verifyPassword("OutraSenha123", first), false);
});
