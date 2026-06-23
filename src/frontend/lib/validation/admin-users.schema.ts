import { z } from "zod";

export const roleSchema = z.enum(["administrator", "application_owner", "viewer"]);

export const createUserSchema = z.object({
  username: z
    .string({ required_error: "Username is required." })
    .min(1, "Username must not be empty.")
    .max(255, "Username must be 255 characters or fewer.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, numbers, periods, underscores, or hyphens."),
  email: z
    .string({ required_error: "Email is required." })
    .email("Email must be a valid email address.")
    .max(320, "Email must be 320 characters or fewer."),
  displayName: z.string().max(255, "Display name must be 255 characters or fewer.").optional(),
  isActive: z.boolean({ invalid_type_error: "isActive must be a boolean." }).default(true),
  roleId: roleSchema.optional(),
  applicationIds: z.array(z.string().uuid("Each application ID must be a valid UUID.")).optional()
});

export const assignRoleSchema = z.object({
  roleId: roleSchema
});

export const assignApplicationSchema = z
  .object({
    applicationId: z.string().uuid().optional(),
    all: z.boolean().optional()
  })
  .refine((value) => (Boolean(value.applicationId) || Boolean(value.all)) && !(value.applicationId && value.all), {
    message: "Provide either applicationId or all=true"
  });

export const updateUserSchema = z.object({
  roleId: roleSchema.optional(),
  isActive: z.boolean(),
  applicationIds: z.array(z.string().uuid()).optional()
});
