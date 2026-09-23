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

export const rolesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listRoles: builder.query<Role[], void>({
      query: () => "/roles",
      transformResponse: (response: ApiEnvelope<Role[]>) => response.data,
      providesTags: ["Role"],
    }),
  }),
});

export const { useListRolesQuery } = rolesApi;
