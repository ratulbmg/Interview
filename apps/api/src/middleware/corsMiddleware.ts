import { Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";

const allowedOrigins = [
  `http://localhost:${process.env.DASHBOARD_PORT ?? 3002}`,
];

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
};

const devCorsOptions: CorsOptions = {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  // NOT "*" — the Fetch spec makes a literal wildcard invalid whenever the
  // request carries credentials (ours always does, for the auth cookie),
  // and Chrome enforces this: it rejects the preflight outright with
  // "Request header field content-type is not allowed by
  // Access-Control-Allow-Headers in preflight response" the moment
  // credentials: 'include' is combined with allowedHeaders: "*" (confirmed
  // via Chrome's own devtools). Has to be an explicit list once credentials
  // are involved, same as the production corsOptions above.
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
};

/**
 * Chrome's Private Network Access checks (rolled out progressively since
 * 2023) send an extra `Access-Control-Request-Private-Network: true`
 * preflight header whenever a page fetches a "more private" address than
 * its own origin — which localhost:3002 (the dashboard) fetching
 * localhost:3001 (this API) can trigger depending on the browser's exact
 * network classification of "localhost". Without an explicit
 * `Access-Control-Allow-Private-Network: true` reply, Chrome silently
 * fails the preflight — no console warning distinguishing it from a
 * regular CORS rejection, just a blocked request. The `cors` package
 * doesn't send this header, so it's added by hand here, ahead of it.
 */
function privateNetworkAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.headers["access-control-request-private-network"]) {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  next();
}

const corsForEnv =
  process.env.API_NODE_ENV === "production"
    ? cors(corsOptions)
    : cors(devCorsOptions);

export const corsMiddleware = [privateNetworkAccess, corsForEnv];

export default corsMiddleware;
