import { Router } from "express";
import {
  createSeason,
  getSeasonById,
  getSeasons,
  setCurrentSeason,
  updateSeason,
} from "../controllers/season.controller.js";

export const seasonRoutes = Router();

seasonRoutes.post("/seasons", createSeason);
seasonRoutes.get("/seasons", getSeasons);
seasonRoutes.get("/seasons/:id", getSeasonById);
seasonRoutes.patch("/seasons/:id", updateSeason);
seasonRoutes.patch("/seasons/:id/set-current", setCurrentSeason);
