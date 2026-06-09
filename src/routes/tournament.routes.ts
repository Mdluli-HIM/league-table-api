import { Router } from "express";
import {
  generateKnockoutBracket,
  getKnockoutBracket,
  submitKnockoutResult,
} from "../controllers/tournament.controller.js";

export const tournamentRoutes = Router();

tournamentRoutes.post(
  "/competitions/:competitionId/bracket/generate",
  generateKnockoutBracket,
);

tournamentRoutes.get(
  "/competitions/:competitionId/bracket",
  getKnockoutBracket,
);

tournamentRoutes.patch("/knockout/matches/:id/result", submitKnockoutResult);
