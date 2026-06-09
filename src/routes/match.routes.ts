import { Router } from "express";
import {
  createLeagueMatch,
  getLeagueStandings,
  getMatchById,
  getMatches,
  submitLeagueResult,
  updateLeagueMatch,
} from "../controllers/match.controller.js";

export const matchRoutes = Router();

matchRoutes.post("/competitions/:competitionId/matches", createLeagueMatch);
matchRoutes.get("/competitions/:competitionId/standings", getLeagueStandings);

matchRoutes.get("/matches", getMatches);
matchRoutes.get("/matches/:id", getMatchById);
matchRoutes.patch("/matches/:id", updateLeagueMatch);
matchRoutes.patch("/matches/:id/result", submitLeagueResult);
