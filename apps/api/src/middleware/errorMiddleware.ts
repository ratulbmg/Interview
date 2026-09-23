import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { apiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";
import { ZodError } from "zod";

// Express identifies error-handling middleware by arity: the `next` parameter must
// be declared (even though it is unused) or Express treats this as ordinary
// middleware, never calls it, and falls back to its default HTML error page.
const errorHandler: ErrorRequestHandler = (
  err,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) => {
  console.error(`[${req.method} ${req.originalUrl}]`, err);

  let statusCode: number;
  let errorMessage: string;
  let errors: unknown;

  if (err instanceof apiError) {
    statusCode = err.statusCode;
    errorMessage = err.message;
    errors = err.errors || null;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    errorMessage = "Validation failed";
    errors = err.issues[0]?.message || "Validation error";
  } else {
    statusCode = 500;
    errorMessage = "Internal Server Error";
    errors = err.message || "Something went wrong";
  }

  const errorResponse = new ApiResponse(
    statusCode,
    { message: errorMessage, errors },
    "null",
  );
  res.status(statusCode).json(errorResponse);
};

export default errorHandler;
