import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { apiResponse } from "../utils/api-response.js";
import { slugify } from "../utils/slugify.js";
import {
  createSeasonSchema,
  updateSeasonSchema,
} from "../validators/season.validator.js";

function getIdParam(req: Request, res: Response) {
  const { id } = req.params;

  if (typeof id !== "string" || id.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: "Invalid season id",
      data: null,
    });

    return null;
  }

  return id;
}

export async function createSeason(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = createSeasonSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const data = validation.data;
    const finalSlug = data.slug ? slugify(data.slug) : slugify(data.name);

    const existingSeason = await prisma.season.findUnique({
      where: {
        slug: finalSlug,
      },
    });

    if (existingSeason) {
      return res.status(409).json({
        success: false,
        message: "A season with this name or slug already exists",
        data: null,
      });
    }

    const season = await prisma.$transaction(async (tx) => {
      if (data.isCurrent) {
        await tx.season.updateMany({
          where: {
            isCurrent: true,
          },
          data: {
            isCurrent: false,
          },
        });
      }

      return tx.season.create({
        data: {
          name: data.name,
          slug: finalSlug,
          startDate: data.startDate,
          endDate: data.endDate,
          status: data.status ?? "UPCOMING",
          isCurrent: data.isCurrent ?? false,
        },
      });
    });

    return res
      .status(201)
      .json(apiResponse("Season created successfully", season));
  } catch (error) {
    next(error);
  }
}

export async function getSeasons(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;

    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;

    const validStatuses = ["UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED"];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid season status",
        data: {
          allowedStatuses: validStatuses,
        },
      });
    }

    const seasons = await prisma.season.findMany({
      where: {
        ...(status
          ? {
              status: status as
                | "UPCOMING"
                | "ACTIVE"
                | "COMPLETED"
                | "ARCHIVED",
            }
          : {}),
        ...(search
          ? {
              name: {
                contains: search,
                mode: "insensitive",
              },
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            competitions: true,
            playerRegistrations: true,
          },
        },
      },
      orderBy: [
        {
          isCurrent: "desc",
        },
        {
          startDate: "desc",
        },
      ],
    });

    return res
      .status(200)
      .json(apiResponse("Seasons fetched successfully", seasons));
  } catch (error) {
    next(error);
  }
}

export async function getSeasonById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const seasonId = getIdParam(req, res);

    if (!seasonId) {
      return;
    }

    const season = await prisma.season.findUnique({
      where: {
        id: seasonId,
      },
      include: {
        competitions: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            status: true,
          },
        },
        _count: {
          select: {
            competitions: true,
            playerRegistrations: true,
          },
        },
      },
    });

    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
        data: null,
      });
    }

    return res
      .status(200)
      .json(apiResponse("Season fetched successfully", season));
  } catch (error) {
    next(error);
  }
}

export async function updateSeason(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const seasonId = getIdParam(req, res);

    if (!seasonId) {
      return;
    }

    const validation = updateSeasonSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const existingSeason = await prisma.season.findUnique({
      where: {
        id: seasonId,
      },
    });

    if (!existingSeason) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
        data: null,
      });
    }

    const data = validation.data;

    const finalSlug =
      data.slug || data.name
        ? slugify(data.slug ?? data.name ?? existingSeason.name)
        : undefined;

    if (finalSlug && finalSlug !== existingSeason.slug) {
      const slugExists = await prisma.season.findUnique({
        where: {
          slug: finalSlug,
        },
      });

      if (slugExists) {
        return res.status(409).json({
          success: false,
          message: "A season with this slug already exists",
          data: null,
        });
      }
    }

    const season = await prisma.$transaction(async (tx) => {
      if (data.isCurrent) {
        await tx.season.updateMany({
          where: {
            isCurrent: true,
          },
          data: {
            isCurrent: false,
          },
        });
      }

      return tx.season.update({
        where: {
          id: seasonId,
        },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(finalSlug ? { slug: finalSlug } : {}),
          ...(data.startDate ? { startDate: data.startDate } : {}),
          ...(data.endDate ? { endDate: data.endDate } : {}),
          ...(data.status ? { status: data.status } : {}),
          ...(typeof data.isCurrent === "boolean"
            ? { isCurrent: data.isCurrent }
            : {}),
        },
      });
    });

    return res
      .status(200)
      .json(apiResponse("Season updated successfully", season));
  } catch (error) {
    next(error);
  }
}

export async function setCurrentSeason(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const seasonId = getIdParam(req, res);

    if (!seasonId) {
      return;
    }

    const existingSeason = await prisma.season.findUnique({
      where: {
        id: seasonId,
      },
    });

    if (!existingSeason) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
        data: null,
      });
    }

    const season = await prisma.$transaction(async (tx) => {
      await tx.season.updateMany({
        where: {
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });

      return tx.season.update({
        where: {
          id: seasonId,
        },
        data: {
          isCurrent: true,
          status: "ACTIVE",
        },
      });
    });

    return res
      .status(200)
      .json(apiResponse("Current season set successfully", season));
  } catch (error) {
    next(error);
  }
}
