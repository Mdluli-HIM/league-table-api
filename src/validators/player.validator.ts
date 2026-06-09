import { z } from "zod";

const registrationStatusSchema = z.enum(["ACTIVE", "INACTIVE", "RELEASED"]);

export const createPlayerSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
});

export const updatePlayerSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .optional(),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .optional(),
});

export const createPlayerRegistrationSchema = z.object({
  playerId: z.string().min(1, "Player id is required"),
  clubId: z.string().min(1, "Club id is required"),
  seasonId: z.string().min(1, "Season id is required"),
  status: registrationStatusSchema.optional(),
});

export const updatePlayerRegistrationStatusSchema = z.object({
  status: registrationStatusSchema,
});
