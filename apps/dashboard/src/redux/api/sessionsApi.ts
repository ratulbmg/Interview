import { baseApi, ApiEnvelope } from "./baseApi";
import { Candidate } from "./candidatesApi";
import { Role } from "./rolesApi";

export type SessionStatus =
  | "SCHEDULED"
  | "INVITE_SENT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED";

export interface Session {
  id: number;
  candidateId: number;
  roleId: number;
  status: SessionStatus;
  scheduledAt: string;
  meetingUrl: string | null;
  transcript: unknown;
  reportJson: unknown;
  createdAt: string;
  candidate: Candidate;
  role: Role;
}

export interface ScheduleSessionRequest {
  candidateId: number;
  roleId: number;
  scheduledAt: string;
}

export const sessionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listSessions: builder.query<Session[], void>({
      query: () => "/sessions",
      transformResponse: (response: ApiEnvelope<Session[]>) => response.data,
      providesTags: ["Session"],
    }),
    getSession: builder.query<Session, number>({
      query: (id) => `/sessions/${id}`,
      transformResponse: (response: ApiEnvelope<Session>) => response.data,
      providesTags: ["Session"],
    }),
    scheduleSession: builder.mutation<Session, ScheduleSessionRequest>({
      query: (body) => ({ url: "/sessions", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<Session>) => response.data,
      invalidatesTags: ["Session"],
    }),
    // The recruiter's last required action — everything after runs on its
    // own (see the API's sessionService.sendInvite).
    sendInvite: builder.mutation<Session, number>({
      query: (id) => ({ url: `/sessions/${id}/send-invite`, method: "POST" }),
      transformResponse: (response: ApiEnvelope<Session>) => response.data,
      invalidatesTags: ["Session"],
    }),
  }),
});

export const {
  useListSessionsQuery,
  useGetSessionQuery,
  useScheduleSessionMutation,
  useSendInviteMutation,
} = sessionsApi;
