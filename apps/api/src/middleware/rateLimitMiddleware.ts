import rateLimit, {
  type RateLimitExceededEventHandler,
} from "express-rate-limit";
import { ApiResponse } from "../utils/apiResponse";

/** Same JSON shape every other error on this API responds with (see
 * errorMiddleware.ts) — a rate-limited request looks like any other API
 * error to a client. */
const rateLimitHandler: RateLimitExceededEventHandler = (_req, res) => {
  res.status(429).json(
    new ApiResponse(
      429,
      {
        message: "Too many requests",
        errors: "You've made too many requests. Please try again later.",
      },
      "null",
    ),
  );
};

/** Baseline limit applied to every route — a backstop against runaway
 * traffic, not aimed at any one endpoint. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Strict limit for /login specifically — makes brute-forcing a password
 * impractical. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
