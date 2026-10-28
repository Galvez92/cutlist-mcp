import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** Ruta absoluta de un fixture de tests/fixtures/. */
export function fixturePath(rel: string): string {
  return join(here, "..", "fixtures", rel);
}

/** Lee un fixture de tests/fixtures/ como texto UTF-8 (tolera BOM). */
export function fixture(rel: string): string {
  let texto = readFileSync(fixturePath(rel), "utf8");
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  return texto;
}
