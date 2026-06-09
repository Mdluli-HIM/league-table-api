import type { AdminRole } from "@prisma/client";
import type { Request, Response, NextFunction } from "express";

export function requireRole(...allowedRoles: AdminRole[]) {
  return function roleMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        data: null,
      });
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
        data: {
          requiredRoles: allowedRoles,
          currentRole: req.admin.role,
        },
      });
    }

    next();
  };
}
