// Must stay first: ES modules hoist imports above this file's own code, so a
// bare `dotenv.config()` call here would run after modules like
// passport.config.ts have already read process.env.
import "dotenv/config";

import Express from "express";
import cookieParser from "cookie-parser";
import routes from "./routes";
import corsMiddleware from "./middleware/corsMiddleware";
import { apiLimiter } from "./middleware/rateLimitMiddleware";
import { UPLOAD_DIR } from "./middleware/uploadMiddleware";
import errorHandler from "./middleware/errorMiddleware";
import passport from "./config/passport.config";

const app = Express();
app.use(corsMiddleware);
app.use(apiLimiter);
// Self-hosted CV storage (see uploadMiddleware.ts) — served directly, no
// third-party file host involved.
app.use("/uploads", Express.static(UPLOAD_DIR));
app.use(Express.json());
// Must run before passport so the cookie extractor can read `req.cookies`.
app.use(cookieParser());
// Stateless JWT auth — `passport.session()` is deliberately not used.
app.use(passport.initialize());

app.use(routes);

app.use(errorHandler);

export default app;
