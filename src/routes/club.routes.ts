import { Router } from "express";
import {
  archiveClub,
  createClub,
  getClubById,
  getClubs,
  restoreClub,
  updateClub,
} from "../controllers/club.controller.js";

export const clubRoutes = Router();

clubRoutes.post("/clubs", createClub);
clubRoutes.get("/clubs", getClubs);
clubRoutes.get("/clubs/:id", getClubById);
clubRoutes.patch("/clubs/:id", updateClub);
clubRoutes.patch("/clubs/:id/archive", archiveClub);
clubRoutes.patch("/clubs/:id/restore", restoreClub);
