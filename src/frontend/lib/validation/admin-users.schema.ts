import { z } from "zod";

export const roleSchema = z.enum(["administrator", "application_owner", "viewer"]);

export const createUserSchema = z.object({
  username: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email().max(320),
  displayName: z.string().max(255).optional(),
  isActive: z.boolean().default(true),
  roleId: roleSchema.optional(),
  applicationIds: z.array(z.string().uuid()).optional()
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
