import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { apiResponse } from "../utils/api-response.js";
import {
  createPlayerRegistrationSchema,
  createPlayerSchema,
  updatePlayerRegistrationStatusSchema,
  updatePlayerSchema,
} from "../validators/player.validator.js";

function getIdParam(req: Request, res: Response, paramName = "id") {
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

export async function createPlayer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = createPlayerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const player = await prisma.player.create({
      data: validation.data,
    });

    return res
      .status(201)
      .json(apiResponse("Player created successfully", player));
  } catch (error) {
    next(error);
  }
}

export async function getPlayers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;

    const players = await prisma.player.findMany({
      where: {
        ...(search
          ? {
              OR: [
                {
                  firstName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  lastName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        registrations: {
          include: {
            club: {
              select: {
                id: true,
                name: true,
                shortName: true,
                slug: true,
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
            registrations: true,
          },
        },
      },
      orderBy: [
        {
          lastName: "asc",
        },
        {
          firstName: "asc",
        },
      ],
    });

    return res
      .status(200)
      .json(apiResponse("Players fetched successfully", players));
  } catch (error) {
    next(error);
  }
}

export async function getPlayerById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const playerId = getIdParam(req, res);

    if (!playerId) {
      return;
    }

    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
      include: {
        registrations: {
          include: {
            club: {
              select: {
                id: true,
                name: true,
                shortName: true,
                slug: true,
                homeGround: true,
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
      },
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found",
        data: null,
      });
    }

    return res
      .status(200)
      .json(apiResponse("Player fetched successfully", player));
  } catch (error) {
    next(error);
  }
}

export async function updatePlayer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const playerId = getIdParam(req, res);

    if (!playerId) {
      return;
    }

    const validation = updatePlayerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const existingPlayer = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!existingPlayer) {
      return res.status(404).json({
        success: false,
        message: "Player not found",
        data: null,
      });
    }

    const data = validation.data;

    const player = await prisma.player.update({
      where: {
        id: playerId,
      },
      data: {
        ...(data.firstName ? { firstName: data.firstName } : {}),
        ...(data.lastName ? { lastName: data.lastName } : {}),
      },
    });

    return res
      .status(200)
      .json(apiResponse("Player updated successfully", player));
  } catch (error) {
    next(error);
  }
}

export async function createPlayerRegistration(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = createPlayerRegistrationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const data = validation.data;

    const [player, club, season] = await Promise.all([
      prisma.player.findUnique({
        where: {
          id: data.playerId,
        },
      }),
      prisma.club.findUnique({
        where: {
          id: data.clubId,
        },
      }),
      prisma.season.findUnique({
        where: {
          id: data.seasonId,
        },
      }),
    ]);

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found",
        data: null,
      });
    }

    if (!club) {
      return res.status(404).json({
        success: false,
        message: "Club not found",
        data: null,
      });
    }

    if (!club.isActive) {
      return res.status(400).json({
        success: false,
        message: "Inactive clubs cannot register players",
        data: null,
      });
    }

    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
        data: null,
      });
    }

    const existingRegistration = await prisma.playerRegistration.findUnique({
      where: {
        playerId_seasonId: {
          playerId: data.playerId,
          seasonId: data.seasonId,
        },
      },
      include: {
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (existingRegistration) {
      return res.status(409).json({
        success: false,
        message: "Player is already registered for this season",
        data: {
          existingClub: existingRegistration.club,
          registrationId: existingRegistration.id,
        },
      });
    }

    const registration = await prisma.playerRegistration.create({
      data: {
        playerId: data.playerId,
        clubId: data.clubId,
        seasonId: data.seasonId,
        status: data.status ?? "ACTIVE",
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        club: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
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
    });

    return res
      .status(201)
      .json(apiResponse("Player registered successfully", registration));
  } catch (error) {
    next(error);
  }
}

export async function getPlayerRegistrations(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const seasonId =
      typeof req.query.seasonId === "string" ? req.query.seasonId : undefined;

    const clubId =
      typeof req.query.clubId === "string" ? req.query.clubId : undefined;

    const playerId =
      typeof req.query.playerId === "string" ? req.query.playerId : undefined;

    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;

    const validStatuses = ["ACTIVE", "INACTIVE", "RELEASED"];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration status",
        data: {
          allowedStatuses: validStatuses,
        },
      });
    }

    const registrations = await prisma.playerRegistration.findMany({
      where: {
        ...(seasonId ? { seasonId } : {}),
        ...(clubId ? { clubId } : {}),
        ...(playerId ? { playerId } : {}),
        ...(status
          ? {
              status: status as "ACTIVE" | "INACTIVE" | "RELEASED",
            }
          : {}),
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        club: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
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
      orderBy: [
        {
          season: {
            startDate: "desc",
          },
        },
        {
          player: {
            lastName: "asc",
          },
        },
      ],
    });

    return res
      .status(200)
      .json(
        apiResponse("Player registrations fetched successfully", registrations),
      );
  } catch (error) {
    next(error);
  }
}

export async function updatePlayerRegistrationStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const registrationId = getIdParam(req, res);

    if (!registrationId) {
      return;
    }

    const validation = updatePlayerRegistrationStatusSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const existingRegistration = await prisma.playerRegistration.findUnique({
      where: {
        id: registrationId,
      },
    });

    if (!existingRegistration) {
      return res.status(404).json({
        success: false,
        message: "Player registration not found",
        data: null,
      });
    }

    const registration = await prisma.playerRegistration.update({
      where: {
        id: registrationId,
      },
      data: {
        status: validation.data.status,
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        club: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
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
    });

    return res
      .status(200)
      .json(
        apiResponse("Player registration updated successfully", registration),
      );
  } catch (error) {
    next(error);
  }
}

export async function getClubSquad(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const clubId = getIdParam(req, res, "clubId");

    if (!clubId) {
      return;
    }

    const seasonId =
      typeof req.query.seasonId === "string" ? req.query.seasonId : undefined;

    if (!seasonId) {
      return res.status(400).json({
        success: false,
        message: "seasonId query parameter is required",
        data: null,
      });
    }

    const club = await prisma.club.findUnique({
      where: {
        id: clubId,
      },
      select: {
        id: true,
        name: true,
        shortName: true,
        slug: true,
      },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: "Club not found",
        data: null,
      });
    }

    const season = await prisma.season.findUnique({
      where: {
        id: seasonId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        isCurrent: true,
      },
    });

    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
        data: null,
      });
    }

    const squad = await prisma.playerRegistration.findMany({
      where: {
        clubId,
        seasonId,
        status: "ACTIVE",
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        {
          player: {
            lastName: "asc",
          },
        },
        {
          player: {
            firstName: "asc",
          },
        },
      ],
    });

    return res.status(200).json(
      apiResponse("Club squad fetched successfully", {
        club,
        season,
        players: squad.map((registration) => ({
          registrationId: registration.id,
          playerId: registration.player.id,
          firstName: registration.player.firstName,
          lastName: registration.player.lastName,
          status: registration.status,
        })),
      }),
    );
  } catch (error) {
    next(error);
  }
}
