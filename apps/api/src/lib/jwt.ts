import jwt, { SignOptions } from "jsonwebtoken";
import { CookieOptions } from "express";
import { apiError } from "../utils/apiError";

/**
 * Everything we're willing to put inside a signed token. `uniqueId` is the
 * lookup key — the passport strategy re-reads the user from the DB on every
 * request, so a deactivated account loses access immediately rather than
 * waiting for the token to expire.
 */
export interface JWTPayload {
  uniqueId: string;
  name: string;
}

/**
 * Fails loudly when the secret is missing instead of quietly signing with
 * the string "undefined", which would let anyone forge a valid token.
 * Resolved on every call rather than cached at module load, since ES module
 * import hoisting can otherwise run this before dotenv has populated
 * process.env.
 */
export const getJwtSecret = (): string => {
  const secret = process.env.API_JWT_SECRET;

  if (!secret) {
    throw new Error(
      "API_JWT_SECRET is not set. Refusing to sign or verify tokens.",
    );
  }

  return secret;
};

/** Name of the httpOnly cookie the dashboard authenticates with. */
export const AUTH_COOKIE_NAME = "token";

/** Default token lifetime. Kept in one place so the cookie maxAge can match it. */
export const TOKEN_VALIDITY_DAYS = 7;

export const createToken = async (
  data: JWTPayload,
  validity: SignOptions["expiresIn"] = `${TOKEN_VALIDITY_DAYS}d`,
): Promise<string> => {
  return jwt.sign(data, getJwtSecret(), { expiresIn: validity });
};

export const verifyToken = async (token: string): Promise<JWTPayload> => {
  try {
    token = token.startsWith("Bearer ") ? token.slice(7) : token;
    const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;
    if (!decoded.uniqueId) {
      throw new apiError("Authentication required", 401);
    }
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new apiError("Token expired", 401);
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new apiError("Invalid token", 401);
    } else {
      throw new apiError("Token verification failed", 401);
    }
  }
};

/**
 * httpOnly: JavaScript can't read the token, so an XSS bug can't exfiltrate
 * it. sameSite/secure relax in dev so the Vite dashboard's http://localhost
 * origin works without HTTPS.
 */
export const authCookieOptions = (): CookieOptions => {
  const isProduction = process.env.API_NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: TOKEN_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  };
};
