import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { apiResponse } from "../utils/api-response.js";
import { getIdParam, getOptionalString } from "../utils/request.js";
import {
  createVenueSchema,
  updateVenueSchema,
} from "../validators/venue.validator.js";

export async function createVenue(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = createVenueSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const data = validation.data;

    const existingVenue = await prisma.venue.findFirst({
      where: {
        name: {
          equals: data.name,
          mode: "insensitive",
        },
      },
    });

    if (existingVenue) {
      return res.status(409).json({
        success: false,
        message: "A venue with this name already exists",
        data: null,
      });
    }

    const venue = await prisma.venue.create({
      data: {
        name: data.name,
        address: data.address,
        isActive: data.isActive ?? true,
      },
      include: {
        _count: {
          select: {
            matches: true,
          },
        },
      },
    });

    return res
      .status(201)
      .json(apiResponse("Venue created successfully", venue));
  } catch (error) {
    next(error);
  }
}

export async function getVenues(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const search = getOptionalString(req.query.search);
    const isActiveQuery = getOptionalString(req.query.isActive);

    const isActive =
      isActiveQuery === "true"
        ? true
        : isActiveQuery === "false"
          ? false
          : undefined;

    const venues = await prisma.venue.findMany({
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
                  address: {
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
            matches: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return res
      .status(200)
      .json(apiResponse("Venues fetched successfully", venues));
  } catch (error) {
    next(error);
  }
}

export async function getVenueById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const venueId = getIdParam(req, res);

    if (!venueId) {
      return;
    }

    const venue = await prisma.venue.findUnique({
      where: {
        id: venueId,
      },
      include: {
        matches: {
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
            homeClub: {
              select: {
                id: true,
                name: true,
                shortName: true,
                slug: true,
              },
            },
            awayClub: {
              select: {
                id: true,
                name: true,
                shortName: true,
                slug: true,
              },
            },
          },
          orderBy: [
            {
              scheduledAt: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
          take: 20,
        },
        _count: {
          select: {
            matches: true,
          },
        },
      },
    });

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
        data: null,
      });
    }

    return res
      .status(200)
      .json(apiResponse("Venue fetched successfully", venue));
  } catch (error) {
    next(error);
  }
}

export async function updateVenue(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const venueId = getIdParam(req, res);

    if (!venueId) {
      return;
    }

    const validation = updateVenueSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const existingVenue = await prisma.venue.findUnique({
      where: {
        id: venueId,
      },
    });

    if (!existingVenue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
        data: null,
      });
    }

    const data = validation.data;

    if (data.name && data.name !== existingVenue.name) {
      const nameExists = await prisma.venue.findFirst({
        where: {
          id: {
            not: venueId,
          },
          name: {
            equals: data.name,
            mode: "insensitive",
          },
        },
      });

      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "A venue with this name already exists",
          data: null,
        });
      }
    }

    const venue = await prisma.venue.update({
      where: {
        id: venueId,
      },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(typeof data.isActive === "boolean"
          ? { isActive: data.isActive }
          : {}),
      },
      include: {
        _count: {
          select: {
            matches: true,
          },
        },
      },
    });

    return res
      .status(200)
      .json(apiResponse("Venue updated successfully", venue));
  } catch (error) {
    next(error);
  }
}

export async function archiveVenue(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const venueId = getIdParam(req, res);

    if (!venueId) {
      return;
    }

    const existingVenue = await prisma.venue.findUnique({
      where: {
        id: venueId,
      },
    });

    if (!existingVenue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
        data: null,
      });
    }

    const venue = await prisma.venue.update({
      where: {
        id: venueId,
      },
      data: {
        isActive: false,
      },
      include: {
        _count: {
          select: {
            matches: true,
          },
        },
      },
    });

    return res
      .status(200)
      .json(apiResponse("Venue archived successfully", venue));
  } catch (error) {
    next(error);
  }
}

export async function restoreVenue(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const venueId = getIdParam(req, res);

    if (!venueId) {
      return;
    }

    const existingVenue = await prisma.venue.findUnique({
      where: {
        id: venueId,
      },
    });

    if (!existingVenue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
        data: null,
      });
    }

    const venue = await prisma.venue.update({
      where: {
        id: venueId,
      },
      data: {
        isActive: true,
      },
      include: {
        _count: {
          select: {
            matches: true,
          },
        },
      },
    });

    return res
      .status(200)
      .json(apiResponse("Venue restored successfully", venue));
  } catch (error) {
    next(error);
  }
}
