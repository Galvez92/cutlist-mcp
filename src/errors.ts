/** Error de entrada del motor, con código estable para tests y llamadores. */

export class OptimizeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OptimizeError";
    this.code = code;
  }
}
