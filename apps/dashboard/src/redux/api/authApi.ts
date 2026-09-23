import { baseApi, ApiEnvelope } from "./baseApi";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  name: string;
  token: string;
}

export interface MeResponse {
  uniqueId: string;
  name: string;
  email: string;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<LoginResponse>) =>
        response.data,
      invalidatesTags: ["Me"],
    }),
    logout: builder.mutation<null, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
      invalidatesTags: ["Me"],
    }),
    me: builder.query<MeResponse, void>({
      query: () => "/auth/me",
      transformResponse: (response: ApiEnvelope<MeResponse>) => response.data,
      providesTags: ["Me"],
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useMeQuery } = authApi;
