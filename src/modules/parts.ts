/**
 * Piezas, cantos, veta y mecanizado: modelo base de la lista de corte.
 *
 * Convención de medidas (mm)
 * --------------------------
 * Cada pieza se define con dos medidas y usa el vocabulario registrado en
 * `docs/memoria/MEMORIA.md` para el despiece de Cortecloud: ``largo`` (campo `c`
 * del fixture) y ``ancho`` (campo `l` del fixture). Igual que en ese despiece,
 * la pieza se dibuja con el ``largo`` en vertical::
 *
 *         ancho_a  (arista de longitud = ancho)
 *       +-------------------+
 *       |                   |
 *  largo_a               largo_b     <- aristas de longitud = largo
 *       |                   |
 *       +-------------------+
 *         ancho_b  (arista de longitud = ancho)
 *
 * Los cuatro nombres de arista (``largo_a``, ``largo_b``, ``ancho_a``,
 * ``ancho_b``) son **geométricos**: no dicen si la arista queda al frente, arriba
 * o abajo en el mueble armado. Esa lectura va en ``funcion`` (texto libre) porque
 * depende de cómo se monta la pieza.
 *
 * Equivalencia con el formato de Cortecloud: ``c1`` = ``largo_a`` (segmento 0-1),
 * ``c2`` = ``largo_b`` (segmento 2-3), ``l1`` = ``ancho_b`` (segmento 1-2, lado
 * inferior) y ``l2`` = ``ancho_a`` (segmento 3-0, lado superior), según la guía
 * oficial del formato. La conversión vive en `./cortecloud.ts`.
 *
 * El canto se guarda como el texto del material del canto (igual que en
 * Cortecloud) o ``null`` si la arista no lleva canto.
 *
 * Puente al motor de optimización
 * -------------------------------
 * `toPartInput()`/`toPart()` exponen la pieza con los tipos del motor
 * (`src/types.ts`): ``width = ancho``, ``height = largo`` y ``edges`` con el
 * espesor de canto de cada lado. La veta de la pieza (``largo``/``ancho``/
 * ``indiferente``) se mapea a la veta del motor (``vertical``/``horizontal``/
 * ``none``). El reparto de las aristas geométricas a los lados absolutos
 * (arriba/derecha/abajo/izquierda) es **por revisar**: es una convención de esta
 * capa, no una equivalencia verificada con el formato de Cortecloud.
 */

import { EPS, emptyEdges } from "../geometry.js";
import type {
  EdgeBanding,
  GrainDirection,
  Part,
  PartInput,
} from "../types.js";

/** Aristas de una pieza: dos de longitud `largo` y dos de longitud `ancho`. */
export const LADOS = ["largo_a", "largo_b", "ancho_a", "ancho_b"] as const;
export type Lado = (typeof LADOS)[number];

/** Dirección de la veta en el vocabulario de la pieza (relativa a la pieza). */
export type Veta = "largo" | "ancho" | "indiferente";
export const VETAS: readonly Veta[] = ["largo", "ancho", "indiferente"];

export const ESPESOR_DEFAULT = 18.0;
export const CANTO_ESPESOR_DEFAULT = 0.4;

/** Veta de la pieza → veta del motor de optimización. */
export function vetaAGrain(veta: Veta): GrainDirection {
  switch (veta) {
    case "largo":
      return "vertical";
    case "ancho":
      return "horizontal";
    case "indiferente":
      return "none";
  }
}

/** Canto por arista. El valor es el texto del material de canto o ``null``. */
export class Cantos {
  constructor(
    readonly largoA: string | null = null,
    readonly largoB: string | null = null,
    readonly anchoA: string | null = null,
    readonly anchoB: string | null = null,
  ) {}

  /** Nombres de las aristas que llevan canto, en orden. */
  aristas(): Lado[] {
    return LADOS.filter((lado) => this.valor(lado) !== null);
  }

  /** Solo las aristas con canto: ``{ "largo_a": "PVC 0.4 mm" }``. */
  porArista(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const lado of LADOS) {
      const valor = this.valor(lado);
      if (valor !== null) out[lado] = valor;
    }
    return out;
  }

  cantidad(): number {
    return this.aristas().length;
  }

  vacio(): boolean {
    return this.cantidad() === 0;
  }

  /** Copia con algunas aristas cambiadas (valida los nombres en snake_case). */
  con(cambios: Partial<Record<Lado, string | null>>): Cantos {
    const desconocidos = Object.keys(cambios).filter(
      (k) => !(LADOS as readonly string[]).includes(k),
    );
    if (desconocidos.length) {
      throw new ValueError(
        `aristas desconocidas: ${desconocidos.sort().join(", ")}; use ${LADOS.join(", ")}`,
      );
    }
    return new Cantos(
      cambios.largo_a !== undefined ? cambios.largo_a : this.largoA,
      cambios.largo_b !== undefined ? cambios.largo_b : this.largoB,
      cambios.ancho_a !== undefined ? cambios.ancho_a : this.anchoA,
      cambios.ancho_b !== undefined ? cambios.ancho_b : this.anchoB,
    );
  }

  /** Copia con canto en las cuatro aristas. */
  todas(material: string): Cantos {
    return new Cantos(material, material, material, material);
  }

  private valor(lado: Lado): string | null {
    switch (lado) {
      case "largo_a":
        return this.largoA;
      case "largo_b":
        return this.largoB;
      case "ancho_a":
        return this.anchoA;
      case "ancho_b":
        return this.anchoB;
    }
  }

  /** Clave de igualdad para agrupar líneas idénticas. */
  clave(): string {
    return JSON.stringify([
      this.largoA,
      this.largoB,
      this.anchoA,
      this.anchoB,
    ]);
  }
}

/** Ranura (canal) para insertar un panel, en mm (furrowMachining del fixture). */
export interface Ranura {
  cara: string;
  profundidad: number;
  ancho: number;
  distancia: number;
}

/** Perforación, en mm. ``horizontal`` = barreno en el canto (horizontalDrills). */
export interface Barreno {
  cara: string;
  x: number;
  y: number;
  profundidad: number;
  diametro: number;
  horizontal: boolean;
}

/** Ranura con los mismos valores por defecto que el dataclass de Python. */
export function ranura(init: Partial<Ranura> = {}): Ranura {
  return { cara: "i", profundidad: 0, ancho: 0, distancia: 0, ...init };
}

/** Barreno con los mismos valores por defecto que el dataclass de Python. */
export function barreno(init: Partial<Barreno> = {}): Barreno {
  return { cara: "i", x: 0, y: 0, profundidad: 0, diametro: 0, horizontal: false, ...init };
}

/** Mecanizado de una pieza: ranuras y barrenos. */
export class Mecanizado {
  constructor(
    readonly ranuras: readonly Ranura[] = [],
    readonly barrenos: readonly Barreno[] = [],
  ) {}

  vacio(): boolean {
    return this.ranuras.length === 0 && this.barrenos.length === 0;
  }

  /** Clave de igualdad para agrupar líneas idénticas. */
  clave(): string {
    return JSON.stringify({ r: this.ranuras, b: this.barrenos });
  }
}

export interface PiezaInit {
  nombre: string;
  largo: number;
  ancho: number;
  cantidad?: number;
  espesor?: number;
  material?: string;
  rol?: string;
  veta?: Veta;
  cantoEspesor?: number;
  cantos?: Cantos;
  mecanizado?: Mecanizado;
  funcion?: string;
  modulo?: string;
}

/** Una línea de la lista de corte. */
export class Pieza {
  readonly nombre: string;
  readonly largo: number;
  readonly ancho: number;
  readonly cantidad: number;
  readonly espesor: number;
  readonly material: string;
  readonly rol: string;
  readonly veta: Veta;
  readonly cantoEspesor: number;
  readonly cantos: Cantos;
  readonly mecanizado: Mecanizado;
  readonly funcion: string;
  readonly modulo: string;

  constructor(init: PiezaInit) {
    this.nombre = init.nombre;
    this.largo = init.largo;
    this.ancho = init.ancho;
    this.cantidad = init.cantidad ?? 1;
    this.espesor = init.espesor ?? ESPESOR_DEFAULT;
    this.material = init.material ?? "";
    this.rol = init.rol ?? "";
    this.veta = init.veta ?? "largo";
    this.cantoEspesor = init.cantoEspesor ?? CANTO_ESPESOR_DEFAULT;
    this.cantos = init.cantos ?? new Cantos();
    this.mecanizado = init.mecanizado ?? new Mecanizado();
    this.funcion = init.funcion ?? "";
    this.modulo = init.modulo ?? "";

    if (!VETAS.includes(this.veta)) {
      throw new ValueError(`veta inválida: ${JSON.stringify(this.veta)}; use ${VETAS.join(", ")}`);
    }
    if (this.cantidad < 0) {
      throw new ValueError("la cantidad no puede ser negativa");
    }
  }

  get areaMm2(): number {
    return this.largo * this.ancho;
  }

  /** ``(largo, ancho)`` terminados: suma el canto de las aristas opuestas. */
  medidasTerminadas(): { largo: number; ancho: number } {
    const largo =
      this.largo +
      (this.cantos.anchoA ? this.cantoEspesor : 0) +
      (this.cantos.anchoB ? this.cantoEspesor : 0);
    const ancho =
      this.ancho +
      (this.cantos.largoA ? this.cantoEspesor : 0) +
      (this.cantos.largoB ? this.cantoEspesor : 0);
    return { largo, ancho };
  }

  /** Copia con algunos campos cambiados. */
  con(cambios: Partial<PiezaInit>): Pieza {
    return new Pieza({ ...this, ...cambios });
  }

  toDict(): Record<string, unknown> {
    const { largo, ancho } = this.medidasTerminadas();
    const datos: Record<string, unknown> = {
      nombre: this.nombre,
      rol: this.rol,
      largo: this.largo,
      ancho: this.ancho,
      cantidad: this.cantidad,
      espesor: this.espesor,
      material: this.material,
      veta: this.veta,
      cantos: this.cantos.porArista(),
      canto_espesor: this.cantoEspesor,
      largo_terminado: largo,
      ancho_terminado: ancho,
      funcion: this.funcion,
      modulo: this.modulo,
    };
    if (!this.mecanizado.vacio()) {
      datos["mecanizado"] = {
        ranuras: this.mecanizado.ranuras.map((r) => ({ ...r })),
        barrenos: this.mecanizado.barrenos.map((b) => ({ ...b })),
      };
    }
    return datos;
  }

  /**
   * Reparto de las aristas geométricas a los lados absolutos del motor.
   *
   * ``ancho_a``→arriba, ``ancho_b``→abajo, ``largo_a``→izquierda,
   * ``largo_b``→derecha; es la misma lectura que los lados ``c1``/``c2``/``l1``/
   * ``l2`` documentados por Cortecloud (ver `./cortecloud.ts`).
   */
  edgesDelMotor(): EdgeBanding {
    const e = emptyEdges();
    if (this.cantos.anchoA) e.top = this.cantoEspesor;
    if (this.cantos.anchoB) e.bottom = this.cantoEspesor;
    if (this.cantos.largoA) e.left = this.cantoEspesor;
    if (this.cantos.largoB) e.right = this.cantoEspesor;
    return e;
  }

  /** Pieza como entrada del motor de optimización (width = ancho, height = largo). */
  toPartInput(): PartInput {
    return {
      id: this.nombre,
      code: this.nombre,
      label: this.funcion || this.nombre,
      width: this.ancho,
      height: this.largo,
      qty: this.cantidad,
      grain: vetaAGrain(this.veta),
      edges: this.edgesDelMotor(),
      material: this.material || undefined,
      thickness: this.espesor,
    };
  }

  /** Pieza normalizada del motor (todos los campos por defecto aplicados). */
  toPart(): Part {
    const input = this.toPartInput();
    return {
      id: input.id!,
      code: input.code!,
      label: input.label!,
      width: input.width,
      height: input.height,
      qty: input.qty!,
      grain: input.grain!,
      edges: this.edgesDelMotor(),
      material: input.material,
      thickness: input.thickness,
    };
  }

  /** Clave de agrupación de líneas idénticas. */
  clave(): string {
    return JSON.stringify([
      this.nombre,
      this.largo,
      this.ancho,
      this.espesor,
      this.material,
      this.rol,
      this.veta,
      this.cantos.clave(),
      this.mecanizado.clave(),
    ]);
  }
}

/** Agrupa líneas idénticas y suma cantidades (como hacen los despieces). */
export function resumen(piezas: Iterable<Pieza>): Pieza[] {
  const orden: string[] = [];
  const agrupadas = new Map<string, Pieza>();
  for (const pieza of piezas) {
    const clave = pieza.clave();
    const previa = agrupadas.get(clave);
    if (previa) {
      agrupadas.set(clave, previa.con({ cantidad: previa.cantidad + pieza.cantidad }));
    } else {
      agrupadas.set(clave, pieza);
      orden.push(clave);
    }
  }
  return orden.map((clave) => agrupadas.get(clave)!);
}

export interface Totales {
  lineas: number;
  unidades: number;
  area_mm2: number;
  area_m2: number;
}

/** Totales de una lista de piezas (ya resumida o no). */
export function totales(piezas: Iterable<Pieza>): Totales {
  let lineas = 0;
  let unidades = 0;
  let area_mm2 = 0.0;
  for (const pieza of piezas) {
    lineas += 1;
    unidades += pieza.cantidad;
    area_mm2 += pieza.areaMm2 * pieza.cantidad;
  }
  return { lineas, unidades, area_mm2, area_m2: area_mm2 / 1_000_000.0 };
}

/** Lista de corte en texto plano (ancho fijo) para leer en consola. */
export function tabla(piezas: Iterable<Pieza>): string {
  const filas = resumen(piezas);
  const encabezado =
    "Cant    Largo    Ancho   Esp  Canto        Veta  Nombre";
  const lineas = [encabezado, "-".repeat(encabezado.length)];
  for (const pieza of filas) {
    lineas.push(
      `${String(pieza.cantidad).padStart(5)}  ${pieza.largo.toFixed(1).padStart(8)}  ` +
        `${pieza.ancho.toFixed(1).padStart(8)}  ${pieza.espesor.toFixed(0).padStart(4)}  ` +
        `${String(pieza.cantos.cantidad()).padStart(5)}  ${pieza.veta.padStart(11)}  ${pieza.nombre}`,
    );
  }
  const datos = totales(filas);
  lineas.push("-".repeat(encabezado.length));
  lineas.push(
    `${String(datos.unidades).padStart(5)} piezas en ${datos.lineas} líneas  ` +
      `(${datos.area_m2.toFixed(2)} m² de tablero)`,
  );
  return lineas.join("\n");
}

/** ¿Dos números son iguales dentro de la tolerancia del motor? */
export function igual(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPS;
}

/** Error de valor de la capa de módulos (mensaje claro para los tests). */
export class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValueError";
  }
}
