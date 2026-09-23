import { baseApi, ApiEnvelope } from "./baseApi";

export interface Candidate {
  id: number;
  uniqueId: string;
  email: string;
  name: string | null;
  cvUrl: string;
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
  }),
});

export const { useListCandidatesQuery, useAddCandidateMutation } =
  candidatesApi;
