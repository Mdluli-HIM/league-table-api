import { Router } from "express";
import { getCurrentAdmin, loginAdmin } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const authRoutes = Router();

authRoutes.post("/auth/login", loginAdmin);
authRoutes.get("/auth/me", requireAuth, getCurrentAdmin);
