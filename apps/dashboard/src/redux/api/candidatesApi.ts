import { baseApi, ApiEnvelope } from "./baseApi";

export interface CvParsedProfile {
  skills: string[];
  years_experience: number;
  projects: { name: string; description: string }[];
  employers: string[];
  seniority_signal: string;
  raw_text: string;
}

export interface Candidate {
  id: number;
  uniqueId: string;
  email: string;
  name: string | null;
  cvUrl: string;
  cvParsedJson: CvParsedProfile | null;
  createdAt: string;
}

export const candidatesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listCandidates: builder.query<Candidate[], void>({
      query: () => "/candidates",
      transformResponse: (response: ApiEnvelope<Candidate[]>) => response.data,
      providesTags: ["Candidate"],
    }),
    // email + optional name + CV file — no age, no role. Sent as
    // multipart/form-data since a file is attached.
    addCandidate: builder.mutation<Candidate, FormData>({
      query: (formData) => ({
        url: "/candidates",
        method: "POST",
        body: formData,
      }),
      transformResponse: (response: ApiEnvelope<Candidate>) => response.data,
      invalidatesTags: ["Candidate"],
    }),
    // Cascades to all of this candidate's sessions at the database level
    // (see packages/db/prisma/schema.prisma) — invalidating both tags
    // keeps the Sessions page in sync too, not just Candidates.
    deleteCandidate: builder.mutation<void, number>({
      query: (id) => ({ url: `/candidates/${id}`, method: "DELETE" }),
      invalidatesTags: ["Candidate", "Session"],
    }),
  }),
});

export const {
  useListCandidatesQuery,
  useAddCandidateMutation,
  useDeleteCandidateMutation,
} = candidatesApi;
