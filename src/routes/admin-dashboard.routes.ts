import { Router } from "express";
import { getAdminDashboardSummary } from "../controllers/admin-dashboard.controller.js";

export const adminDashboardRoutes = Router();

adminDashboardRoutes.get("/admin/dashboard", getAdminDashboardSummary);
