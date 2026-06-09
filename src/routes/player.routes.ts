import { Router } from "express";
import {
  createPlayer,
  createPlayerRegistration,
  getClubSquad,
  getPlayerById,
  getPlayerRegistrations,
  getPlayers,
  updatePlayer,
  updatePlayerRegistrationStatus,
} from "../controllers/player.controller.js";

export const playerRoutes = Router();

playerRoutes.post("/players", createPlayer);
playerRoutes.get("/players", getPlayers);
playerRoutes.get("/players/:id", getPlayerById);
playerRoutes.patch("/players/:id", updatePlayer);

playerRoutes.post("/player-registrations", createPlayerRegistration);
playerRoutes.get("/player-registrations", getPlayerRegistrations);
playerRoutes.patch(
  "/player-registrations/:id/status",
  updatePlayerRegistrationStatus,
);

playerRoutes.get("/clubs/:clubId/squad", getClubSquad);
