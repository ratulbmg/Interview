import { Request, Response } from "express";
import { authService } from "../service";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { loginUserSchema } from "../validation";
import { AUTH_COOKIE_NAME, authCookieOptions } from "../lib/jwt";

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const validated = loginUserSchema.parse(req.body);
  const response = await authService.loginUser(validated);

  res.cookie(AUTH_COOKIE_NAME, response.token, authCookieOptions());
  res.status(200).json(new ApiResponse(200, response, "Logged in"));
});

/** Clears the cookie with the same options it was set with, otherwise the
 * browser won't match and remove it. */
export const logoutUser = asyncHandler(async (req: Request, res: Response) => {
  const { maxAge: _maxAge, ...clearOptions } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, clearOptions);
  res.status(200).json(new ApiResponse(200, null, "Logged out"));
});

export const meAccount = asyncHandler(async (req: Request, res: Response) => {
  // `req.user` is populated by the passport JWT strategy in authMiddleware.
  const response = await authService.meAccount(req.user!);
  res.status(200).json(new ApiResponse(200, response, "User details"));
});
