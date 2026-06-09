import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { apiResponse } from "../utils/api-response.js";
import { slugify } from "../utils/slugify.js";
import {
  createClubSchema,
  updateClubSchema,
} from "../validators/club.validator.js";

function getIdParam(req: Request, res: Response) {
  const { id } = req.params;

  if (typeof id !== "string" || id.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: "Invalid club id",
      data: null,
    });

    return null;
  }

  return id;
}

export async function createClub(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = createClubSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const data = validation.data;
    const finalSlug = data.slug ? slugify(data.slug) : slugify(data.name);

    const existingClub = await prisma.club.findUnique({
      where: {
        slug: finalSlug,
      },
    });

    if (existingClub) {
      return res.status(409).json({
        success: false,
        message: "A club with this name or slug already exists",
        data: null,
      });
    }

    const club = await prisma.club.create({
      data: {
        name: data.name,
        shortName: data.shortName,
        slug: finalSlug,
        homeGround: data.homeGround,
        foundedYear: data.foundedYear,
        isActive: data.isActive ?? true,
      },
    });

    return res.status(201).json(apiResponse("Club created successfully", club));
  } catch (error) {
    next(error);
  }
}

export async function getClubs(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;

    const isActiveQuery =
      typeof req.query.isActive === "string" ? req.query.isActive : undefined;

    const isActive =
      isActiveQuery === "true"
        ? true
        : isActiveQuery === "false"
          ? false
          : undefined;

    const clubs = await prisma.club.findMany({
      where: {
        ...(typeof isActive === "boolean" ? { isActive } : {}),
        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  shortName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  homeGround: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            competitionTeams: true,
            playerRegistrations: true,
            homeMatches: true,
            awayMatches: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return res
      .status(200)
      .json(apiResponse("Clubs fetched successfully", clubs));
  } catch (error) {
    next(error);
  }
}

export async function getClubById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const clubId = getIdParam(req, res);

    if (!clubId) {
      return;
    }

    const club = await prisma.club.findUnique({
      where: {
        id: clubId,
      },
      include: {
        competitionTeams: {
          include: {
            competition: {
              select: {
                id: true,
                name: true,
                slug: true,
                type: true,
                status: true,
              },
            },
          },
        },
        playerRegistrations: {
          include: {
            player: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            season: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                isCurrent: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            competitionTeams: true,
            playerRegistrations: true,
            homeMatches: true,
            awayMatches: true,
          },
        },
      },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: "Club not found",
        data: null,
      });
    }

    return res.status(200).json(apiResponse("Club fetched successfully", club));
  } catch (error) {
    next(error);
  }
}

export async function updateClub(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const clubId = getIdParam(req, res);

    if (!clubId) {
      return;
    }

    const validation = updateClubSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const existingClub = await prisma.club.findUnique({
      where: {
        id: clubId,
      },
    });

    if (!existingClub) {
      return res.status(404).json({
        success: false,
        message: "Club not found",
        data: null,
      });
    }

    const data = validation.data;

    const finalSlug =
      data.slug || data.name
        ? slugify(data.slug ?? data.name ?? existingClub.name)
        : undefined;

    if (finalSlug && finalSlug !== existingClub.slug) {
      const slugExists = await prisma.club.findUnique({
        where: {
          slug: finalSlug,
        },
      });

      if (slugExists) {
        return res.status(409).json({
          success: false,
          message: "A club with this slug already exists",
          data: null,
        });
      }
    }

    const club = await prisma.club.update({
      where: {
        id: clubId,
      },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.shortName ? { shortName: data.shortName } : {}),
        ...(finalSlug ? { slug: finalSlug } : {}),
        ...(data.homeGround ? { homeGround: data.homeGround } : {}),
        ...(typeof data.foundedYear === "number"
          ? { foundedYear: data.foundedYear }
          : {}),
        ...(typeof data.isActive === "boolean"
          ? { isActive: data.isActive }
          : {}),
      },
    });

    return res.status(200).json(apiResponse("Club updated successfully", club));
  } catch (error) {
    next(error);
  }
}

export async function archiveClub(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const clubId = getIdParam(req, res);

    if (!clubId) {
      return;
    }

    const existingClub = await prisma.club.findUnique({
      where: {
        id: clubId,
      },
    });

    if (!existingClub) {
      return res.status(404).json({
        success: false,
        message: "Club not found",
        data: null,
      });
    }

    const club = await prisma.club.update({
      where: {
        id: clubId,
      },
      data: {
        isActive: false,
      },
    });

    return res
      .status(200)
      .json(apiResponse("Club archived successfully", club));
  } catch (error) {
    next(error);
  }
}

export async function restoreClub(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const clubId = getIdParam(req, res);

    if (!clubId) {
      return;
    }

    const existingClub = await prisma.club.findUnique({
      where: {
        id: clubId,
      },
    });

    if (!existingClub) {
      return res.status(404).json({
        success: false,
        message: "Club not found",
        data: null,
      });
    }

    const club = await prisma.club.update({
      where: {
        id: clubId,
      },
      data: {
        isActive: true,
      },
    });

    return res
      .status(200)
      .json(apiResponse("Club restored successfully", club));
  } catch (error) {
    next(error);
  }
}
