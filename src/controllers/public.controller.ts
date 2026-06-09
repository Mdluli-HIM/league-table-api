import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { apiResponse } from "../utils/api-response.js";
import { calculateLeagueStandings } from "../services/standings.service.js";

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

function getPositiveLimit(value: unknown, fallback: number, max: number) {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function getOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

export async function getPublicCurrentSeason(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const currentSeason = await prisma.season.findFirst({
      where: {
        isCurrent: true,
      },
      include: {
        _count: {
          select: {
            competitions: true,
            playerRegistrations: true,
          },
        },
      },
    });

    if (!currentSeason) {
      return res.status(404).json({
        success: false,
        message: "Current season not found",
        data: null,
      });
    }

    return res
      .status(200)
      .json(apiResponse("Current season fetched successfully", currentSeason));
  } catch (error) {
    next(error);
  }
}

export async function getPublicHome(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const seasonIdFromQuery = getOptionalString(req.query.seasonId);

    const season = seasonIdFromQuery
      ? await prisma.season.findUnique({
          where: {
            id: seasonIdFromQuery,
          },
        })
      : await prisma.season.findFirst({
          where: {
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

    const competitions = await prisma.competition.findMany({
      where: {
        seasonId: season.id,
        status: {
          in: ["ACTIVE", "COMPLETED"],
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        _count: {
          select: {
            teams: true,
            matches: true,
            rounds: true,
          },
        },
      },
      orderBy: [
        {
          type: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    const leagueCompetition = competitions.find(
      (competition) => competition.type === "LEAGUE",
    );

    const latestResults = await prisma.match.findMany({
      where: {
        competition: {
          seasonId: season.id,
        },
        status: "COMPLETED",
      },
      include: {
        competition: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
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
        winnerClub: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
          },
        },
        round: {
          select: {
            id: true,
            name: true,
            roundType: true,
            roundOrder: true,
          },
        },
        venue: true,
      },
      orderBy: [
        {
          updatedAt: "desc",
        },
      ],
      take: 5,
    });

    const upcomingFixtures = await prisma.match.findMany({
      where: {
        competition: {
          seasonId: season.id,
        },
        status: "SCHEDULED",
      },
      include: {
        competition: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
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
        round: {
          select: {
            id: true,
            name: true,
            roundType: true,
            roundOrder: true,
          },
        },
        venue: true,
      },
      orderBy: [
        {
          scheduledAt: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
      take: 5,
    });

    const standingsResult = leagueCompetition
      ? await calculateLeagueStandings(leagueCompetition.id)
      : null;

    return res.status(200).json(
      apiResponse("Public home data fetched successfully", {
        season,
        competitions,
        tablePreview: standingsResult?.standings?.slice(0, 5) ?? [],
        latestResults,
        upcomingFixtures,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function getPublicCompetitions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const seasonId = getOptionalString(req.query.seasonId);
    const type = getOptionalString(req.query.type);
    const status = getOptionalString(req.query.status);

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
          : {
              status: {
                in: ["ACTIVE", "COMPLETED"],
              },
            }),
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
      .json(
        apiResponse("Public competitions fetched successfully", competitions),
      );
  } catch (error) {
    next(error);
  }
}

export async function getPublicCompetitionById(
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
      .json(
        apiResponse("Public competition fetched successfully", competition),
      );
  } catch (error) {
    next(error);
  }
}

export async function getPublicLeagueTable(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getIdParam(req, res, "competitionId");

    if (!competitionId) {
      return;
    }

    const result = await calculateLeagueStandings(competitionId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Competition not found",
        data: null,
      });
    }

    if (!result.standings) {
      return res.status(400).json({
        success: false,
        message: "Table is only available for league competitions",
        data: {
          competitionType: result.competition.type,
        },
      });
    }

    return res.status(200).json(
      apiResponse("Public league table fetched successfully", {
        competition: {
          id: result.competition.id,
          name: result.competition.name,
          slug: result.competition.slug,
          type: result.competition.type,
          status: result.competition.status,
          season: result.competition.season,
        },
        standings: result.standings,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function getPublicFixtures(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getOptionalString(req.query.competitionId);
    const clubId = getOptionalString(req.query.clubId);
    const limit = getPositiveLimit(req.query.limit, 50, 100);

    const fixtures = await prisma.match.findMany({
      where: {
        status: "SCHEDULED",
        ...(competitionId ? { competitionId } : {}),
        ...(clubId
          ? {
              OR: [
                {
                  homeClubId: clubId,
                },
                {
                  awayClubId: clubId,
                },
              ],
            }
          : {}),
      },
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
        round: {
          select: {
            id: true,
            name: true,
            roundType: true,
            roundOrder: true,
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
        venue: true,
      },
      orderBy: [
        {
          scheduledAt: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
      take: limit,
    });

    return res
      .status(200)
      .json(apiResponse("Public fixtures fetched successfully", fixtures));
  } catch (error) {
    next(error);
  }
}

export async function getPublicResults(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getOptionalString(req.query.competitionId);
    const clubId = getOptionalString(req.query.clubId);
    const limit = getPositiveLimit(req.query.limit, 50, 100);

    const results = await prisma.match.findMany({
      where: {
        status: "COMPLETED",
        ...(competitionId ? { competitionId } : {}),
        ...(clubId
          ? {
              OR: [
                {
                  homeClubId: clubId,
                },
                {
                  awayClubId: clubId,
                },
              ],
            }
          : {}),
      },
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
        round: {
          select: {
            id: true,
            name: true,
            roundType: true,
            roundOrder: true,
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
        winnerClub: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
          },
        },
        venue: true,
      },
      orderBy: [
        {
          updatedAt: "desc",
        },
      ],
      take: limit,
    });

    return res
      .status(200)
      .json(apiResponse("Public results fetched successfully", results));
  } catch (error) {
    next(error);
  }
}

export async function getPublicClubs(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const search = getOptionalString(req.query.search);

    const clubs = await prisma.club.findMany({
      where: {
        isActive: true,
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
      select: {
        id: true,
        name: true,
        shortName: true,
        slug: true,
        homeGround: true,
        foundedYear: true,
        _count: {
          select: {
            competitionTeams: true,
            playerRegistrations: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return res
      .status(200)
      .json(apiResponse("Public clubs fetched successfully", clubs));
  } catch (error) {
    next(error);
  }
}

export async function getPublicClubById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const clubId = getIdParam(req, res);

    if (!clubId) {
      return;
    }

    const seasonId = getOptionalString(req.query.seasonId);

    const club = await prisma.club.findUnique({
      where: {
        id: clubId,
      },
      select: {
        id: true,
        name: true,
        shortName: true,
        slug: true,
        homeGround: true,
        foundedYear: true,
        isActive: true,
        competitionTeams: {
          include: {
            competition: {
              select: {
                id: true,
                name: true,
                slug: true,
                type: true,
                status: true,
                season: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    isCurrent: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!club || !club.isActive) {
      return res.status(404).json({
        success: false,
        message: "Club not found",
        data: null,
      });
    }

    const activeSeason = seasonId
      ? await prisma.season.findUnique({
          where: {
            id: seasonId,
          },
        })
      : await prisma.season.findFirst({
          where: {
            isCurrent: true,
          },
        });

    const squad = activeSeason
      ? await prisma.playerRegistration.findMany({
          where: {
            clubId,
            seasonId: activeSeason.id,
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
        })
      : [];

    const fixtures = await prisma.match.findMany({
      where: {
        status: "SCHEDULED",
        OR: [
          {
            homeClubId: clubId,
          },
          {
            awayClubId: clubId,
          },
        ],
      },
      include: {
        competition: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
        round: {
          select: {
            id: true,
            name: true,
            roundType: true,
            roundOrder: true,
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
        venue: true,
      },
      orderBy: [
        {
          scheduledAt: "asc",
        },
      ],
      take: 5,
    });

    const results = await prisma.match.findMany({
      where: {
        status: "COMPLETED",
        OR: [
          {
            homeClubId: clubId,
          },
          {
            awayClubId: clubId,
          },
        ],
      },
      include: {
        competition: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
        round: {
          select: {
            id: true,
            name: true,
            roundType: true,
            roundOrder: true,
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
        winnerClub: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
          },
        },
        venue: true,
      },
      orderBy: [
        {
          updatedAt: "desc",
        },
      ],
      take: 5,
    });

    return res.status(200).json(
      apiResponse("Public club fetched successfully", {
        ...club,
        activeSeason,
        squad: squad.map((registration) => ({
          registrationId: registration.id,
          playerId: registration.player.id,
          firstName: registration.player.firstName,
          lastName: registration.player.lastName,
          status: registration.status,
        })),
        fixtures,
        results,
      }),
    );
  } catch (error) {
    next(error);
  }
}

export async function getPublicTournamentBracket(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getIdParam(req, res, "competitionId");

    if (!competitionId) {
      return;
    }

    const bracket = await prisma.competition.findUnique({
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
          include: {
            matches: {
              include: {
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
                winnerClub: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                    slug: true,
                  },
                },
                venue: true,
              },
              orderBy: {
                bracketPosition: "asc",
              },
            },
          },
          orderBy: {
            roundOrder: "asc",
          },
        },
      },
    });

    if (!bracket) {
      return res.status(404).json({
        success: false,
        message: "Competition not found",
        data: null,
      });
    }

    if (bracket.type !== "KNOCKOUT") {
      return res.status(400).json({
        success: false,
        message: "Bracket is only available for knockout competitions",
        data: {
          competitionType: bracket.type,
        },
      });
    }

    return res
      .status(200)
      .json(
        apiResponse("Public tournament bracket fetched successfully", bracket),
      );
  } catch (error) {
    next(error);
  }
}
