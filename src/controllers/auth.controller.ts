import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { apiResponse } from "../utils/api-response.js";
import { signAccessToken } from "../utils/jwt.js";
import { loginSchema } from "../validators/auth.validator.js";

export async function loginAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const { email, password } = validation.data;

    const admin = await prisma.adminUser.findUnique({
      where: {
        email,
      },
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        data: null,
      });
    }

    if (admin.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Admin account is disabled",
        data: null,
      });
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        data: null,
      });
    }

    const accessToken = signAccessToken({
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    });

    await prisma.adminUser.update({
      where: {
        id: admin.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return res.status(200).json(
      apiResponse("Login successful", {
        accessToken,
        tokenType: "Bearer",
        expiresInSeconds: env.JWT_ACCESS_EXPIRES_SECONDS,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          status: admin.status,
        },
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function getCurrentAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        data: null,
      });
    }

    const admin = await prisma.adminUser.findUnique({
      where: {
        id: req.admin.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
        data: null,
      });
    }

    return res
      .status(200)
      .json(apiResponse("Current admin fetched successfully", admin));
  } catch (error) {
    next(error);
  }
}
