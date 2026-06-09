import { Router } from "express";
import { getHealthStatus } from "../controllers/health.controller.js";

export const healthRoutes = Router();

healthRoutes.get("/health", getHealthStatus);
