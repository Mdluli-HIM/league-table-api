import { Router } from "express";
import {
  archiveVenue,
  createVenue,
  getVenueById,
  getVenues,
  restoreVenue,
  updateVenue,
} from "../controllers/venue.controller.js";

export const venueRoutes = Router();

venueRoutes.post("/venues", createVenue);
venueRoutes.get("/venues", getVenues);
venueRoutes.get("/venues/:id", getVenueById);
venueRoutes.patch("/venues/:id", updateVenue);
venueRoutes.patch("/venues/:id/archive", archiveVenue);
venueRoutes.patch("/venues/:id/restore", restoreVenue);
