import { z } from "zod";

export const createVenueSchema = z.object({
  name: z.string().min(2, "Venue name must be at least 2 characters"),
  address: z
    .string()
    .min(2, "Address must be at least 2 characters")
    .optional(),
  isActive: z.boolean().optional(),
});

export const updateVenueSchema = z.object({
  name: z
    .string()
    .min(2, "Venue name must be at least 2 characters")
    .optional(),
  address: z
    .string()
    .min(2, "Address must be at least 2 characters")
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});
