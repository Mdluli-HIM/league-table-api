import type { AdminRole, AdminStatus } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        email: string;
        role: AdminRole;
        status: AdminStatus;
      };
    }
  }
}

export {}; 