import z from "zod";

// POST /roles — see roleService.createRole for how `competencies` becomes
// the actual blueprint (the fixed opener/cv_probe/scenario/behavioral/
// candidate_questions slots wrap around one core_competency slot per
// entry here, in order).
export const createRoleSchema = z.object({
  name: z.string().trim().min(1, { message: "Please enter a role name" }),
  description: z
    .string()
    .trim()
    .min(1, { message: "Please enter a description" }),
  competencies: z.array(z.string().trim().min(1)).default([]),
});
