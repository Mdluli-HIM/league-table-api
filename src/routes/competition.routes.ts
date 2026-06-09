import { Router } from "express";
import {
  addCompetitionTeams,
  createCompetition,
  getCompetitionById,
  getCompetitions,
  getCompetitionTeams,
  removeCompetitionTeam,
  updateCompetition,
} from "../controllers/competition.controller.js";

export const competitionRoutes = Router();

competitionRoutes.post("/competitions", createCompetition);
competitionRoutes.get("/competitions", getCompetitions);
competitionRoutes.get("/competitions/:id", getCompetitionById);
competitionRoutes.patch("/competitions/:id", updateCompetition);

competitionRoutes.post("/competitions/:id/teams", addCompetitionTeams);
competitionRoutes.get("/competitions/:id/teams", getCompetitionTeams);
competitionRoutes.delete(
  "/competitions/:competitionId/teams/:clubId",
  removeCompetitionTeam,
);
