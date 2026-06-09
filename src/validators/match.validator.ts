import { z } from "zod";

const matchStatusSchema = z.enum([
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "POSTPONED",
  "CANCELLED",
]);

export const createLeagueMatchSchema = z.object({
  homeClubId: z.string().min(1, "Home club id is required"),
  awayClubId: z.string().min(1, "Away club id is required"),
  scheduledAt: z.coerce.date().optional(),
  matchday: z.coerce.number().int().positive().optional(),
  venueId: z.string().min(1).optional(),
});

export const updateLeagueMatchSchema = z.object({
  homeClubId: z.string().min(1).optional(),
  awayClubId: z.string().min(1).optional(),
  scheduledAt: z.coerce.date().optional(),
  matchday: z.coerce.number().int().positive().optional(),
  venueId: z.string().min(1).nullable().optional(),
  status: matchStatusSchema.optional(),
});

export const submitLeagueResultSchema = z.object({
  homeScore: z.coerce.number().int().min(0, "Home score cannot be negative"),
  awayScore: z.coerce.number().int().min(0, "Away score cannot be negative"),
});
