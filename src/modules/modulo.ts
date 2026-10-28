/** Módulo paramétrico: medidas e ideas -> lista de piezas con cantos. */

import { resumen, tabla, totales } from "./parts.js";
import type { Pieza, Totales } from "./parts.js";
import {
  PERFIL_CORTECLOUD_MADIJAL,
  resumenHallazgos,
  validar,
} from "./profiles.js";
import type { PerfilRestricciones } from "./profiles.js";

/** Herraje o complemento del módulo (no es una pieza de tablero). */
export class Accesorio {
  constructor(
    readonly nombre: string,
    readonly cantidad: number = 1,
    readonly nota: string = "",
  ) {}

  toDict(): Record<string, unknown> {
    return { nombre: this.nombre, cantidad: this.cantidad, nota: this.nota };
  }
}

/** Resultado de un generador: piezas, accesorios y notas de armado. */
export class Modulo {
  constructor(
    readonly tipo: string,
    readonly nombre: string,
    readonly medidas: Record<string, number>,
    readonly piezas: Pieza[],
    readonly accesorios: Accesorio[] = [],
    readonly notas: string[] = [],
  ) {}

  /** Líneas agrupadas, listas para el optimizador o el taller. */
  resumen(): Pieza[] {
    return resumen(this.piezas);
  }

  totales(): Totales {
    return totales(this.resumen());
  }

  tabla(): string {
    return tabla(this.piezas);
  }

  validar(perfil: PerfilRestricciones = PERFIL_CORTECLOUD_MADIJAL) {
    return validar(this.resumen(), perfil);
  }

  toDict(): Record<string, unknown> {
    return {
      tipo: this.tipo,
      nombre: this.nombre,
      medidas: this.medidas,
      piezas: this.piezas.map((pieza) => pieza.toDict()),
      accesorios: this.accesorios.map((accesorio) => accesorio.toDict()),
      notas: [...this.notas],
      totales: this.totales(),
    };
  }

  toDictConPerfil(perfil: PerfilRestricciones = PERFIL_CORTECLOUD_MADIJAL): Record<string, unknown> {
    const datos = this.toDict();
    datos["piezas"] = this.resumen().map((pieza) => pieza.toDict());
    datos["perfil"] = perfil.nombre;
    datos["hallazgos"] = resumenHallazgos(this.validar(perfil));
    return datos;
  }
}
