import { baseApi, ApiEnvelope } from "./baseApi";

export interface RoleSlot {
  slot: string;
  competency?: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  blueprint: RoleSlot[];
}

/** Matches apps/api's createRoleSchema — `competencies` becomes one
 * "core_competency" blueprint slot per entry, sandwiched between the fixed
 * opener/cv_probe and scenario/behavioral/candidate_questions slots. */
export interface CreateRoleRequest {
  name: string;
  description: string;
  competencies: string[];
}

export const rolesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listRoles: builder.query<Role[], void>({
      query: () => "/roles",
      transformResponse: (response: ApiEnvelope<Role[]>) => response.data,
      providesTags: ["Role"],
    }),
    addRole: builder.mutation<Role, CreateRoleRequest>({
      query: (body) => ({ url: "/roles", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<Role>) => response.data,
      invalidatesTags: ["Role"],
    }),
  }),
});

export const { useListRolesQuery, useAddRoleMutation } = rolesApi;
