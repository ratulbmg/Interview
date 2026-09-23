import { createToken } from "../lib/jwt";
import { comparePassword } from "../lib/password";
import { apiError } from "../utils/apiError";
import {
  UserLoginRequest,
  UserLoginResponse,
  UserDetailsResponse,
} from "../model/userModel";
import { repositoryWrapper } from "../repository/repositoryWrapper";
import { AuthUser } from "../types/express";

class AuthService {
  async loginUser(req: UserLoginRequest): Promise<UserLoginResponse> {
    const user = await repositoryWrapper.userRepository.findUser({
      email: req.email,
    });

    // Same generic error for "no such user" and "wrong password" so the
    // endpoint can't be used to discover which emails are registered.
    if (!user) {
      throw new apiError("Invalid email or password", 401);
    }

    const isPasswordValid = await comparePassword(
      req.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new apiError("Invalid email or password", 401);
    }

    const token = await createToken({
      uniqueId: user.uniqueId,
      name: user.name,
    });

    return { name: user.name, token };
  }

  async meAccount(viewer: AuthUser): Promise<UserDetailsResponse> {
    const user = await repositoryWrapper.userRepository.findUser({
      uniqueId: viewer.uniqueId,
    });
    if (!user) {
      throw new apiError("User not found", 404);
    }

    return { uniqueId: user.uniqueId, name: user.name, email: user.email };
  }
}

export default AuthService;
