import { baseApi, ApiEnvelope } from "./baseApi";

/** Mirrors apps/api's UserSummary (model/userModel.ts) — every recruiter
 * account on the platform, never including a password hash. */
export interface UserSummary {
  id: number;
  uniqueId: string;
  name: string;
  email: string;
  createdAt: string;
  candidatesCount: number;
  rolesCount: number;
  questionsCount: number;
  sessionsCount: number;
}

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listUsers: builder.query<UserSummary[], void>({
      query: () => "/users",
      transformResponse: (response: ApiEnvelope<UserSummary[]>) =>
        response.data,
      providesTags: ["User"],
    }),
  }),
});

export const { useListUsersQuery } = usersApi;
