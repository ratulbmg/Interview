/**
 * The shape passport attaches to `req.user` after a successful JWT
 * verification. Deliberately excludes `passwordHash`: nothing downstream of
 * auth should ever see it.
 */
export interface AuthUser {
  id: number;
  uniqueId: string;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    // Passport reads this interface to type `req.user`.
    interface User extends AuthUser {}
  }
}

export {};
