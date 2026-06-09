import { z } from "zod";

export const createClubSchema = z.object({
  name: z.string().min(2, "Club name must be at least 2 characters"),
  shortName: z.string().min(1).optional(),
  slug: z.string().optional(),
  homeGround: z.string().min(2).optional(),
  foundedYear: z.coerce
    .number()
    .int()
    .min(1800, "Founded year seems too old")
    .max(new Date().getFullYear(), "Founded year cannot be in the future")
    .optional(),
  isActive: z.boolean().optional(),
});

export const updateClubSchema = z.object({
  name: z.string().min(2, "Club name must be at least 2 characters").optional(),
  shortName: z.string().min(1).optional(),
  slug: z.string().optional(),
  homeGround: z.string().min(2).optional(),
  foundedYear: z.coerce
    .number()
    .int()
    .min(1800, "Founded year seems too old")
    .max(new Date().getFullYear(), "Founded year cannot be in the future")
    .optional(),
  isActive: z.boolean().optional(),
});
