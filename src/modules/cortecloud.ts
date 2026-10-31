/**
 * Cantos: puente entre las aristas de la pieza y los lados `c1`/`c2`/`l1`/`l2`
 * del JSON de Cortecloud.
 *
 * Fuentes oficiales (consultadas 2026-10-29):
 *  - https://cortecloud.com/api-docs/en/guias/json_import/ («Part coordinate
 *    system»: corners 0-3, sides C1/C2/L1/L2, segments 0-1, 1-2, 2-3, 3-0).
 *  - https://apis.cortecloud.com.br/docs/es/guias/importacao-json/#sistema-de-coordenadas
 *    (misma geometría en español, más la tabla de campos: `c` = largo, `l` = ancho).
 *
 * Geometría documentada, con la pieza vista por la **cara interna** (la cara
 * frontal de la imagen):
 *
 *     esquina 0 ----------- L2 ----------- esquina 3
 *         |                                     |
 *        C1                                    C2
 *         |                                     |
 *     esquina 1 ----------- L1 ----------- esquina 2
 *
 *  - `c` (largo) es la medida vertical del dibujo y `l` (ancho) la horizontal.
 *  - `c1` = segmento 0-1: arista de longitud `largo`, la **izquierda**.
 *  - `c2` = segmento 2-3: arista de longitud `largo`, la **derecha**.
 *  - `l1` = segmento 1-2: arista de longitud `ancho`, la **inferior**.
 *  - `l2` = segmento 3-0: arista de longitud `ancho`, la **superior**.
 *
 * Esa es la misma lectura que usa `Pieza.edgesDelMotor()` (``largo_a`` →
 * izquierda, ``largo_b`` → derecha, ``ancho_a`` → arriba, ``ancho_b`` → abajo),
 * así que `l1` cae en el lado inferior del motor y `l2` en el superior.
 *
 * *Por revisar*: el JSON no declara en qué orientación se dibujó cada pieza, de
 * modo que el lado **físico** (frente, arriba) sigue dependiendo de cómo se
 * cargó la pieza en Cortecloud; esa lectura va en `funcion`, no en el canto.
 */

import { Cantos } from "./parts.js";
import type { Lado } from "./parts.js";

/** Enlaces de la documentación que define la convención. */
export const CORTECLOUD_FUENTES = {
  importacion: "https://cortecloud.com/api-docs/en/guias/json_import/",
  coordenadas:
    "https://apis.cortecloud.com.br/docs/es/guias/importacao-json/#sistema-de-coordenadas",
} as const;

/** Lados de canto del JSON de Cortecloud. */
export type LadoCortecloud = "c1" | "c2" | "l1" | "l2";

/** Los cuatro lados en el orden documentado de los segmentos (0-1, 1-2, 2-3, 3-0). */
export const LADOS_CORTECLOUD: readonly LadoCortecloud[] = ["c1", "l1", "c2", "l2"];

/** Segmento de esquinas que delimita cada lado (documentado). */
export const SEGMENTOS_CORTECLOUD: Record<LadoCortecloud, string> = {
  c1: "0-1",
  l1: "1-2",
  c2: "2-3",
  l2: "3-0",
};

/** Arista de la pieza que corresponde a cada lado de Cortecloud. */
export const ARISTA_DE_CORTECLOUD: Record<LadoCortecloud, Lado> = {
  c1: "largo_a",
  c2: "largo_b",
  l1: "ancho_b",
  l2: "ancho_a",
};

const CORTECLOUD_DE_ARISTA = Object.fromEntries(
  (Object.entries(ARISTA_DE_CORTECLOUD) as [LadoCortecloud, Lado][]).map(
    ([lado, arista]) => [arista, lado],
  ),
) as Record<Lado, LadoCortecloud>;

/** Lado de Cortecloud de una arista de la pieza. */
export function ladoACortecloud(arista: Lado): LadoCortecloud {
  return CORTECLOUD_DE_ARISTA[arista];
}

/** Canto de cada lado del JSON de una pieza, `null` cuando la arista no lleva canto. */
export type CantosCortecloud = Record<LadoCortecloud, string | null>;

/** Cantos de la pieza como los cuatro campos del JSON de Cortecloud. */
export function cantosACortecloud(cantos: Cantos): CantosCortecloud {
  const porArista = cantos.porArista();
  const salida = {} as CantosCortecloud;
  for (const lado of LADOS_CORTECLOUD) {
    salida[lado] = porArista[ARISTA_DE_CORTECLOUD[lado]] ?? null;
  }
  return salida;
}

/** Lados de canto tal como vienen en una entrada `parts[]` de Cortecloud. */
export interface LadosCortecloudEntrada {
  c1?: string | null;
  c2?: string | null;
  l1?: string | null;
  l2?: string | null;
}

/** Cantos de la pieza a partir de una entrada `parts[]` del JSON de Cortecloud. */
export function cantosDesdeCortecloud(bruto: LadosCortecloudEntrada | null | undefined): Cantos {
  const texto = (lado: LadoCortecloud): string | null => {
    const valor = bruto?.[lado];
    return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null;
  };
  const porArista: Record<Lado, string | null> = {
    largo_a: null,
    largo_b: null,
    ancho_a: null,
    ancho_b: null,
  };
  for (const lado of LADOS_CORTECLOUD) {
    porArista[ARISTA_DE_CORTECLOUD[lado]] = texto(lado);
  }
  return new Cantos(
    porArista.largo_a,
    porArista.largo_b,
    porArista.ancho_a,
    porArista.ancho_b,
  );
}
