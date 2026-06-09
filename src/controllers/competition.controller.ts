import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { apiResponse } from "../utils/api-response.js";
import { slugify } from "../utils/slugify.js";
import {
  addCompetitionTeamsSchema,
  createCompetitionSchema,
  updateCompetitionSchema,
} from "../validators/competition.validator.js";

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

export async function createCompetition(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = createCompetitionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const data = validation.data;
    const finalSlug = data.slug ? slugify(data.slug) : slugify(data.name);

    const season = await prisma.season.findUnique({
      where: {
        id: data.seasonId,
      },
    });

    if (!season) {
      return res.status(404).json({
        success: false,
        message: "Season not found",
        data: null,
      });
    }

    const existingCompetition = await prisma.competition.findUnique({
      where: {
        slug: finalSlug,
      },
    });

    if (existingCompetition) {
      return res.status(409).json({
        success: false,
        message: "A competition with this name or slug already exists",
        data: null,
      });
    }

    const competition = await prisma.competition.create({
      data: {
        seasonId: data.seasonId,
        name: data.name,
        slug: finalSlug,
        type: data.type,
        status: data.status ?? "DRAFT",
        ...(data.startDate ? { startDate: data.startDate } : {}),
        ...(data.endDate ? { endDate: data.endDate } : {}),
      },
      include: {
        season: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            isCurrent: true,
          },
        },
        _count: {
          select: {
            teams: true,
            matches: true,
            rounds: true,
          },
        },
      },
    });

    return res
      .status(201)
      .json(apiResponse("Competition created successfully", competition));
  } catch (error) {
    next(error);
  }
}

export async function getCompetitions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;

    const seasonId =
      typeof req.query.seasonId === "string" ? req.query.seasonId : undefined;

    const type =
      typeof req.query.type === "string" ? req.query.type : undefined;

    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;

    const validTypes = ["LEAGUE", "KNOCKOUT"];
    const validStatuses = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"];

    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid competition type",
        data: {
          allowedTypes: validTypes,
        },
      });
    }

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid competition status",
        data: {
          allowedStatuses: validStatuses,
        },
      });
    }

    const competitions = await prisma.competition.findMany({
      where: {
        ...(seasonId ? { seasonId } : {}),
        ...(type ? { type: type as "LEAGUE" | "KNOCKOUT" } : {}),
        ...(status
          ? {
              status: status as "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED",
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
        season: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            isCurrent: true,
          },
        },
        _count: {
          select: {
            teams: true,
            matches: true,
            rounds: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res
      .status(200)
      .json(apiResponse("Competitions fetched successfully", competitions));
  } catch (error) {
    next(error);
  }
}

export async function getCompetitionById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getIdParam(req, res);

    if (!competitionId) {
      return;
    }

    const competition = await prisma.competition.findUnique({
      where: {
        id: competitionId,
      },
      include: {
        season: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            isCurrent: true,
          },
        },
        teams: {
          include: {
            club: {
              select: {
                id: true,
                name: true,
                shortName: true,
                slug: true,
                homeGround: true,
                isActive: true,
              },
            },
          },
          orderBy: [
            {
              seed: "asc",
            },
            {
              club: {
                name: "asc",
              },
            },
          ],
        },
        rounds: {
          orderBy: {
            roundOrder: "asc",
          },
        },
        _count: {
          select: {
            teams: true,
            matches: true,
            rounds: true,
          },
        },
      },
    });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: "Competition not found",
        data: null,
      });
    }

    return res
      .status(200)
      .json(apiResponse("Competition fetched successfully", competition));
  } catch (error) {
    next(error);
  }
}

export async function updateCompetition(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getIdParam(req, res);

    if (!competitionId) {
      return;
    }

    const validation = updateCompetitionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const existingCompetition = await prisma.competition.findUnique({
      where: {
        id: competitionId,
      },
    });

    if (!existingCompetition) {
      return res.status(404).json({
        success: false,
        message: "Competition not found",
        data: null,
      });
    }

    const data = validation.data;

    if (data.seasonId) {
      const season = await prisma.season.findUnique({
        where: {
          id: data.seasonId,
        },
      });

      if (!season) {
        return res.status(404).json({
          success: false,
          message: "Season not found",
          data: null,
        });
      }
    }

    const finalSlug =
      data.slug || data.name
        ? slugify(data.slug ?? data.name ?? existingCompetition.name)
        : undefined;

    if (finalSlug && finalSlug !== existingCompetition.slug) {
      const slugExists = await prisma.competition.findUnique({
        where: {
          slug: finalSlug,
        },
      });

      if (slugExists) {
        return res.status(409).json({
          success: false,
          message: "A competition with this slug already exists",
          data: null,
        });
      }
    }

    const competition = await prisma.competition.update({
      where: {
        id: competitionId,
      },
      data: {
        ...(data.seasonId ? { seasonId: data.seasonId } : {}),
        ...(data.name ? { name: data.name } : {}),
        ...(finalSlug ? { slug: finalSlug } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.startDate ? { startDate: data.startDate } : {}),
        ...(data.endDate ? { endDate: data.endDate } : {}),
      },
      include: {
        season: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            isCurrent: true,
          },
        },
        _count: {
          select: {
            teams: true,
            matches: true,
            rounds: true,
          },
        },
      },
    });

    return res
      .status(200)
      .json(apiResponse("Competition updated successfully", competition));
  } catch (error) {
    next(error);
  }
}

export async function addCompetitionTeams(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getIdParam(req, res);

    if (!competitionId) {
      return;
    }

    const validation = addCompetitionTeamsSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const competition = await prisma.competition.findUnique({
      where: {
        id: competitionId,
      },
      include: {
        teams: true,
      },
    });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: "Competition not found",
        data: null,
      });
    }

    if (competition.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Teams can only be added while competition is in DRAFT status",
        data: {
          currentStatus: competition.status,
        },
      });
    }

    const incomingTeams = validation.data.teams;

    const incomingClubIds = incomingTeams.map((team) => team.clubId);
    const uniqueClubIds = new Set(incomingClubIds);

    if (uniqueClubIds.size !== incomingClubIds.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate club ids are not allowed",
        data: null,
      });
    }

    const incomingSeeds = incomingTeams
      .map((team) => team.seed)
      .filter((seed): seed is number => typeof seed === "number");

    const uniqueSeeds = new Set(incomingSeeds);

    if (uniqueSeeds.size !== incomingSeeds.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate seeds are not allowed",
        data: null,
      });
    }

    const existingClubIds = new Set(
      competition.teams.map((team) => team.clubId),
    );

    const alreadyAddedClubIds = incomingClubIds.filter((clubId) =>
      existingClubIds.has(clubId),
    );

    if (alreadyAddedClubIds.length > 0) {
      return res.status(409).json({
        success: false,
        message: "One or more clubs are already added to this competition",
        data: {
          clubIds: alreadyAddedClubIds,
        },
      });
    }

    const existingSeeds = new Set(
      competition.teams
        .map((team) => team.seed)
        .filter((seed): seed is number => typeof seed === "number"),
    );

    const alreadyUsedSeeds = incomingSeeds.filter((seed) =>
      existingSeeds.has(seed),
    );

    if (alreadyUsedSeeds.length > 0) {
      return res.status(409).json({
        success: false,
        message: "One or more seeds are already used in this competition",
        data: {
          seeds: alreadyUsedSeeds,
        },
      });
    }

    const clubs = await prisma.club.findMany({
      where: {
        id: {
          in: incomingClubIds,
        },
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (clubs.length !== incomingClubIds.length) {
      const foundClubIds = new Set(clubs.map((club) => club.id));
      const missingClubIds = incomingClubIds.filter(
        (clubId) => !foundClubIds.has(clubId),
      );

      return res.status(404).json({
        success: false,
        message: "One or more clubs were not found",
        data: {
          clubIds: missingClubIds,
        },
      });
    }

    const inactiveClubIds = clubs
      .filter((club) => !club.isActive)
      .map((club) => club.id);

    if (inactiveClubIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Inactive clubs cannot be added to a competition",
        data: {
          clubIds: inactiveClubIds,
        },
      });
    }

    await prisma.competitionTeam.createMany({
      data: incomingTeams.map((team) => ({
        competitionId,
        clubId: team.clubId,
        seed: team.seed,
      })),
    });

    const teams = await prisma.competitionTeam.findMany({
      where: {
        competitionId,
      },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            homeGround: true,
            isActive: true,
          },
        },
      },
      orderBy: [
        {
          seed: "asc",
        },
        {
          club: {
            name: "asc",
          },
        },
      ],
    });

    return res
      .status(201)
      .json(apiResponse("Competition teams added successfully", teams));
  } catch (error) {
    next(error);
  }
}

export async function getCompetitionTeams(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getIdParam(req, res);

    if (!competitionId) {
      return;
    }

    const competition = await prisma.competition.findUnique({
      where: {
        id: competitionId,
      },
    });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: "Competition not found",
        data: null,
      });
    }

    const teams = await prisma.competitionTeam.findMany({
      where: {
        competitionId,
      },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            homeGround: true,
            isActive: true,
          },
        },
      },
      orderBy: [
        {
          seed: "asc",
        },
        {
          club: {
            name: "asc",
          },
        },
      ],
    });

    return res
      .status(200)
      .json(apiResponse("Competition teams fetched successfully", teams));
  } catch (error) {
    next(error);
  }
}

export async function removeCompetitionTeam(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getIdParam(req, res, "competitionId");
    const clubId = getIdParam(req, res, "clubId");

    if (!competitionId || !clubId) {
      return;
    }

    const competition = await prisma.competition.findUnique({
      where: {
        id: competitionId,
      },
    });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: "Competition not found",
        data: null,
      });
    }

    if (competition.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message:
          "Teams can only be removed while competition is in DRAFT status",
        data: {
          currentStatus: competition.status,
        },
      });
    }

    const existingTeam = await prisma.competitionTeam.findUnique({
      where: {
        competitionId_clubId: {
          competitionId,
          clubId,
        },
      },
    });

    if (!existingTeam) {
      return res.status(404).json({
        success: false,
        message: "Club is not part of this competition",
        data: null,
      });
    }

    await prisma.competitionTeam.delete({
      where: {
        competitionId_clubId: {
          competitionId,
          clubId,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Competition team removed successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
}
