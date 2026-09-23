import { Request, Response, NextFunction, RequestHandler } from "express";
import passport from "../config/passport.config";
import { apiError } from "../utils/apiError";
import { AuthUser } from "../types/express";

/**
 * Runs the JWT strategy (Bearer header first, httpOnly cookie second).
 * `session: false` because this API is stateless. On success `req.user`
 * holds an AuthUser that was just re-read from the database.
 */
const authenticate: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  passport.authenticate(
    "jwt",
    { session: false },
    (err: unknown, user: AuthUser | false) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return next(new apiError("Authentication required", 401));
      }
      req.user = user;
      next();
    },
  )(req, res, next);
};

export default authenticate;
