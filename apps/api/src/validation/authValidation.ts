import z from "zod";

export const loginUserSchema = z.object({
  email: z
    .string({ message: "Please enter Email" })
    .trim()
    .email({ message: "Please enter a valid email address" }),
  password: z
    .string({ message: "Please enter Password" })
    .min(1, { message: "Please enter Password" }),
});
