/** Comparación de flotantes con tolerancia tipo pytest.approx. */

import { expect } from "vitest";

/** Espera que `value` sea igual a `esperado` dentro de 1e-6 (relativo/absoluto). */
export function aprox(value: number, esperado: number): void {
  expect(value).toBeCloseTo(esperado, 6);
}
