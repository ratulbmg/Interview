import z from "zod";

export const scheduleSessionSchema = z.object({
  candidateId: z.coerce
    .number()
    .int()
    .positive({ message: "Please pick a candidate" }),
  roleId: z.coerce.number().int().positive({ message: "Please pick a role" }),
  scheduledAt: z.coerce.date({ message: "Please pick a valid date/time" }),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
