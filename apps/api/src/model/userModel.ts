export interface UserLoginRequest {
  email: string;
  password: string;
}

/** The token is also returned in the body (not only set as a cookie) so a
 * future non-browser client has something to store and send back as a
 * Bearer header. */
export interface UserLoginResponse {
  name: string;
  token: string;
}

export interface UserDetailsResponse {
  uniqueId: string;
  name: string;
  email: string;
}
