export class apiError extends Error {
  statusCode: number;
  errors?: unknown;

  constructor(message: string, statusCode: number, errors?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;

    // Ensure the name of this error is the same as the class name
    this.name = this.constructor.name;

    // Capture the stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}
