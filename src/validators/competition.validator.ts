import { z } from "zod";

const competitionTypeSchema = z.enum(["LEAGUE", "KNOCKOUT"]);
const competitionStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "COMPLETED",
  "ARCHIVED",
]);

export const createCompetitionSchema = z
  .object({
    seasonId: z.string().min(1, "Season id is required"),
    name: z.string().min(2, "Competition name must be at least 2 characters"),
    slug: z.string().optional(),
    type: competitionTypeSchema,
    status: competitionStatusSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }

      return true;
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    },
  );

export const updateCompetitionSchema = z
  .object({
    seasonId: z.string().min(1, "Season id is required").optional(),
    name: z
      .string()
      .min(2, "Competition name must be at least 2 characters")
      .optional(),
    slug: z.string().optional(),
    type: competitionTypeSchema.optional(),
    status: competitionStatusSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }

      return true;
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    },
  );

export const addCompetitionTeamsSchema = z.object({
  teams: z
    .array(
      z.object({
        clubId: z.string().min(1, "Club id is required"),
        seed: z.coerce.number().int().positive().optional(),
      }),
    )
    .min(1, "At least one team is required"),
});
