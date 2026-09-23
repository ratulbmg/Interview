import passport from "passport";
import { Request } from "express";
import {
  Strategy as JwtStrategy,
  ExtractJwt,
  StrategyOptionsWithoutRequest,
  JwtFromRequestFunction,
} from "passport-jwt";
import { AUTH_COOKIE_NAME, JWTPayload, getJwtSecret } from "../lib/jwt";
import { repositoryWrapper } from "../repository/repositoryWrapper";
import { AuthUser } from "../types/express";

/** Pulls the JWT out of the httpOnly cookie set at login — the path the
 * dashboard itself uses; the browser sends it automatically and no token
 * ever touches localStorage. */
const cookieExtractor: JwtFromRequestFunction = (req: Request) => {
  if (req && req.cookies) {
    return req.cookies[AUTH_COOKIE_NAME] ?? null;
  }
  return null;
};

/**
 * Hybrid extraction: an Authorization: Bearer header first (for a future
 * non-browser client), the httpOnly cookie second (the dashboard's own
 * path). One strategy serves both.
 */
const jwtOptions: StrategyOptionsWithoutRequest = {
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    cookieExtractor,
  ]),
  secretOrKeyProvider: (_request, _rawJwtToken, done) => {
    try {
      done(null, getJwtSecret());
    } catch (error) {
      done(error as Error, undefined);
    }
  },
};

/**
 * The token is only a claim of identity — re-read the user on every request
 * so a deleted account loses access immediately rather than at token
 * expiry.
 */
passport.use(
  new JwtStrategy(jwtOptions, async (payload: JWTPayload, done) => {
    try {
      const user = await repositoryWrapper.userRepository.findUser({
        uniqueId: payload.uniqueId,
      });

      if (!user) {
        return done(null, false);
      }

      const authUser: AuthUser = {
        id: user.id,
        uniqueId: user.uniqueId,
        name: user.name,
        email: user.email,
      };
      return done(null, authUser);
    } catch (error) {
      return done(error, false);
    }
  }),
);

export default passport;
