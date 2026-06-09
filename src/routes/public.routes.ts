import { Router } from "express";
import {
  getPublicClubById,
  getPublicClubs,
  getPublicCompetitionById,
  getPublicCompetitions,
  getPublicCurrentSeason,
  getPublicFixtures,
  getPublicHome,
  getPublicLeagueTable,
  getPublicResults,
  getPublicTournamentBracket,
} from "../controllers/public.controller.js";

export const publicRoutes = Router();

publicRoutes.get("/public/home", getPublicHome);
publicRoutes.get("/public/seasons/current", getPublicCurrentSeason);

publicRoutes.get("/public/competitions", getPublicCompetitions);
publicRoutes.get("/public/competitions/:id", getPublicCompetitionById);
publicRoutes.get(
  "/public/competitions/:competitionId/table",
  getPublicLeagueTable,
);

publicRoutes.get("/public/fixtures", getPublicFixtures);
publicRoutes.get("/public/results", getPublicResults);

publicRoutes.get("/public/clubs", getPublicClubs);
publicRoutes.get("/public/clubs/:id", getPublicClubById);

publicRoutes.get(
  "/public/tournaments/:competitionId/bracket",
  getPublicTournamentBracket,
);
