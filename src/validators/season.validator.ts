import { z } from "zod";

export const createSeasonSchema = z
  .object({
    name: z.string().min(2, "Season name must be at least 2 characters"),
    slug: z.string().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
    isCurrent: z.boolean().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export const updateSeasonSchema = z
  .object({
    name: z
      .string()
      .min(2, "Season name must be at least 2 characters")
      .optional(),
    slug: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
    isCurrent: z.boolean().optional(),
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
