import type { Request, Response } from "express";

export function getIdParam(
  req: Request,
  res: Response,
  paramName = "id",
): string | null {
  const id = req.params[paramName];

  if (typeof id !== "string" || id.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: `Invalid ${paramName}`,
      data: null,
    });

    return null;
  }

  return id;
}

export function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function getPositiveInteger(
  value: unknown,
  fallback: number,
  max: number,
): number {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}
