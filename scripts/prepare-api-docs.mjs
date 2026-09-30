import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const target = new URL("../public/swagger/", import.meta.url);
await mkdir(target, { recursive: true });
for (const file of ["swagger-ui-bundle.js", "swagger-ui-bundle.js.LICENSE.txt", "swagger-ui.css", "LICENSE", "NOTICE"]) {
  await copyFile(require.resolve(`swagger-ui-dist/${file}`), fileURLToPath(new URL(file, target)));
}
console.info("Assets locais do Swagger preparados.");
