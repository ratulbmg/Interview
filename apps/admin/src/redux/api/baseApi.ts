import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL } from "../../config/api";

/** Every request body from the API is `{ statusCode, data, message, success }`
 * (see apps/api's ApiResponse) — endpoints below unwrap `.data` in
 * `transformResponse` so components work with the payload directly. */
export interface ApiEnvelope<T> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    // Sends the httpOnly auth cookie set at login on every request.
    credentials: "include",
  }),
  tagTypes: ["Candidate", "Session", "Role", "Question", "Me", "Usage", "User"],
  endpoints: () => ({}),
});
