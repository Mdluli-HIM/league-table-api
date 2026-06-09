import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { verifyAccessToken } from "../utils/jwt.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        data: null,
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing",
        data: null,
      });
    }

    const payload = verifyAccessToken(token);

    if (!payload.sub || !payload.email || !payload.role) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
        data: null,
      });
    }

    const admin = await prisma.adminUser.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!admin || admin.status !== "ACTIVE") {
      return res.status(401).json({
        success: false,
        message: "Admin account is not active",
        data: null,
      });
    }

    req.admin = admin;

    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
      data: null,
    });
  }
}
