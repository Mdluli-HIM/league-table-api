import { z } from "zod";

export const generateKnockoutBracketSchema = z.object({
  seedMode: z.enum(["SEED_ORDER"]).optional().default("SEED_ORDER"),
});

export const submitKnockoutResultSchema = z.object({
  homeScore: z.coerce.number().int().min(0, "Home score cannot be negative"),
  awayScore: z.coerce.number().int().min(0, "Away score cannot be negative"),
  homePenaltyScore: z.coerce
    .number()
    .int()
    .min(0, "Home penalty score cannot be negative")
    .optional(),
  awayPenaltyScore: z.coerce
    .number()
    .int()
    .min(0, "Away penalty score cannot be negative")
    .optional(),
});
