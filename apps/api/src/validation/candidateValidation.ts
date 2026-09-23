import z from "zod";

export const addCandidateSchema = z.object({
  email: z
    .string({ message: "Please enter Email" })
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(320),
  name: z.string().trim().max(100).optional().or(z.literal("")),
});
