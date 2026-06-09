import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A record with this value already exists",
        data: error.meta,
      });
    }

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Record not found",
        data: error.meta,
      });
    }
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    data: null,
  });
}
