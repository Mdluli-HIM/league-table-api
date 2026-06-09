import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { apiResponse } from "../utils/api-response.js";

export async function getHealthStatus(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json(
      apiResponse("API is healthy", {
        service: "league-table-api",
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    next(error);
  }
}
