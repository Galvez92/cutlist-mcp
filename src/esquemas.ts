/** Esquemas de entrada de las herramientas MCP (zod v4). Las medidas van en milímetros. */

import * as z from 'zod/v4';

import { TIPOS_MODULO } from './core/modulos';
import { IDS_FORMATOS } from './export';

const canto = z.string().nullable();

export const piezaSchema = z.object({
  id: z.string().optional().describe('Identificador de la pieza; si falta se genera uno.'),
  nombre: z.string().optional().describe('Nombre visible de la pieza (campo `function` de Cortecloud).'),
  largo: z.number().positive().describe('Medida en el eje de la veta (campo `c` de Cortecloud).'),
  ancho: z.number().positive().describe('Medida transversal (campo `l` de Cortecloud).'),
  cantidad: z.number().int().positive().optional().describe('Unidades iguales. Por defecto 1.'),
  veta: z.boolean().optional().describe('`true` = la veta sigue el eje `largo`. La pieza se rota sólo sobre tableros sin veta.'),
  cantos: z
    .object({
      largo1: canto.optional(),
      largo2: canto.optional(),
      ancho1: canto.optional(),
      ancho2: canto.optional()
    })
    .optional()
    .describe('Texto del canto de cada orilla, o `null` si va cruda.'),
  material: z.string().optional(),
  grupo: z.string().optional().describe('Módulo o ambiente al que pertenece (campo `complement` de Cortecloud).'),
  mecanizado: z.boolean().optional().describe('`true` si la pieza lleva barrenos o ranuras.')
});

export const tableroSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().optional(),
  largo: z.number().positive().describe('Medida del tablero en X, en mm.'),
  ancho: z.number().positive().describe('Medida del tablero en Y, en mm.'),
  espesor: z.number().positive().optional().describe('Espesor en mm. Por defecto 18.'),
  kerf: z.number().nonnegative().optional().describe('Ancho de corte de la sierra en mm. Por defecto 3.'),
  cantidad: z.number().int().positive().optional().describe('Hojas disponibles. Si falta, sin límite.'),
  material: z.string().optional().describe('Sólo se colocan piezas del mismo material sobre este tablero.')
});

export const parametrosModuloSchema = z.object({
  tipo: z.enum(TIPOS_MODULO).describe('Tipo de módulo paramétrico.'),
  ancho: z.number().positive().describe('Ancho exterior del módulo en mm.'),
  alto: z.number().positive().describe('Alto exterior en mm (en cocina incluye el zócalo).'),
  profundidad: z.number().positive().describe('Profundidad exterior en mm.'),
  espesor: z.number().positive().optional().describe('Espesor del tablero del cuerpo. Por defecto 18 mm.'),
  cantoFrente: z.string().nullable().optional().describe('Texto del canto de las orillas frontales; `null` = sin canto.'),
  numeroCajones: z.number().int().positive().optional().describe('Cajonera: frentes de cajón. Por defecto 3.'),
  numeroEstantes: z.number().int().positive().optional().describe('Clóset y librero: estantes. Por defecto 1 / 4.'),
  numeroPuertas: z.number().int().positive().optional().describe('Cocina: puertas. Por defecto 2.'),
  altoZocalo: z.number().positive().optional().describe('Cocina: alto del zócalo en mm. Por defecto 100.'),
  holgura: z.number().nonnegative().optional().describe('Holgura entre frentes en mm. Por defecto 3.'),
  nombre: z.string().optional().describe('Nombre del módulo; se usa como grupo de cada pieza.'),
  material: z.string().optional()
});

export const listaPiezasSchema = {
  piezas: z.array(piezaSchema).min(1).describe('Piezas a procesar.')
};

export const opcionesOptimizacionShape = {
  estrategia: z.enum(['guillotina', 'no-guillotina']).optional().describe('Por defecto `auto`: prueba ambas y elige el mejor resultado.'),
  kerf: z.number().nonnegative().optional().describe('Kerf global en mm; si falta se usa el del tablero.'),
  permitirRotacion: z.boolean().optional().describe('`false` desactiva la rotación de todas las piezas.')
};

export const optimizarCorteSchema = z.object({
  piezas: z.array(piezaSchema).min(1),
  tableros: z.array(tableroSchema).min(1),
  ...opcionesOptimizacionShape
});

export const validarDespieceSchema = z.object({
  piezas: z.array(piezaSchema).min(1).describe('Piezas a validar contra el perfil Cortecloud/Madijal.')
});

export const exportarSchema = z.object({
  formato: z
    .enum(IDS_FORMATOS)
    .optional()
    .describe('Formato de salida. Si se omite, devuelve el catálogo de formatos soportados.'),
  piezas: z.array(piezaSchema).min(1).optional().describe('Piezas a exportar. Obligatorio salvo para pedir el catálogo.'),
  tableros: z
    .array(tableroSchema)
    .min(1)
    .optional()
    .describe('Tableros para los formatos que necesitan layout (svg, dxf).'),
  ...opcionesOptimizacionShape
});
