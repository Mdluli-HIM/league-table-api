import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import type { AdminRole } from "@prisma/client";
import { env } from "../config/env.js";

export type AccessTokenPayload = JwtPayload & {
  email?: string;
  role?: AdminRole;
};

export function signAccessToken({
  adminId,
  email,
  role,
}: {
  adminId: string;
  email: string;
  role: AdminRole;
}) {
  const options: SignOptions = {
    subject: adminId,
    expiresIn: env.JWT_ACCESS_EXPIRES_SECONDS,
  };

  return jwt.sign(
    {
      email,
      role,
    },
    env.JWT_ACCESS_SECRET,
    options,
  );
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}
