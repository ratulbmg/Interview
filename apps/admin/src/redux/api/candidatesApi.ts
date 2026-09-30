import { baseApi, ApiEnvelope } from "./baseApi";

type Confidence = "low" | "medium" | "high";

export interface CvParsedBasicInfo {
  name: string | null;
  title: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  summary: string | null;
}

export interface CvParsedTotalExperience {
  years: number | null;
  confidence: Confidence | null;
  evidence: string | null;
}

export interface CvParsedWorkExperienceEntry {
  company: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  duration: string | null;
  responsibilities: string[];
  technologies: string[];
  frameworks_tools: string[];
  achievements: string[];
  measurable_results: string[];
  leadership_responsibilities: string[];
  ownership_level: string | null;
  technical_decisions: string[];
}

export interface CvParsedTechnicalSkills {
  programming_languages: string[];
  frameworks: string[];
  libraries: string[];
  databases: string[];
  cloud_platforms: string[];
  devops_infrastructure: string[];
  testing: string[];
  architecture_design: string[];
  tools: string[];
  other: string[];
}

export interface CvParsedProjectEntry {
  name: string | null;
  description: string | null;
  role: string | null;
  responsibilities: string[];
  technologies: string[];
  architecture: string | null;
  scale: string | null;
  measurable_results: string[];
  challenges: string[];
  outcomes: string[];
  ownership_level: string | null;
}

export interface CvParsedEducationEntry {
  institution: string | null;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  relevant_coursework: string[];
}

export interface CvParsedCertificationEntry {
  name: string | null;
  issuer: string | null;
  date: string | null;
}

export interface CvParsedAchievement {
  description: string;
  category: string | null;
  metric: string | null;
  evidence: string | null;
}

export interface CvParsedCandidateClaim {
  claim: string;
  category: string | null;
  related_skills: string[];
  importance: Confidence | null;
  confidence: Confidence | null;
  evidence: string | null;
}

export interface CvParsedAmbiguousInformation {
  statement: string;
  ambiguity_type: string | null;
  context: string | null;
}

export interface CvParsedCareerProgression {
  summary: string | null;
  signals: string[];
  promotions: string[];
}

export interface CvParsedSeniority {
  level: string;
  confidence: Confidence | null;
  evidence: string | null;
}

/** Matches apps/engine/agent/interview/cv.py's CandidateProfile. The first
 * six fields are the original shape and are always present; everything
 * after is additive and optional, since a candidate parsed before this
 * richer schema existed won't have it in their stored cvParsedJson. */
export interface CvParsedProfile {
  skills: string[];
  years_experience: number;
  projects: CvParsedProjectEntry[];
  employers: string[];
  seniority_signal: string;
  raw_text: string;
  basic_info?: CvParsedBasicInfo;
  total_experience?: CvParsedTotalExperience;
  work_experience?: CvParsedWorkExperienceEntry[];
  technical_skills?: CvParsedTechnicalSkills;
  education?: CvParsedEducationEntry[];
  certifications?: CvParsedCertificationEntry[];
  achievements?: CvParsedAchievement[];
  candidate_claims?: CvParsedCandidateClaim[];
  ambiguous_information?: CvParsedAmbiguousInformation[];
  career_progression?: CvParsedCareerProgression;
  seniority?: CvParsedSeniority;
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
