import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { apiResponse } from "../utils/api-response.js";
import {
  createLeagueMatchSchema,
  submitLeagueResultSchema,
  updateLeagueMatchSchema,
} from "../validators/match.validator.js";

type StandingRow = {
  position: number;
  clubId: string;
  clubName: string;
  shortName: string | null;
  slug: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

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

function getWinnerClubId(
  homeClubId: string,
  awayClubId: string,
  homeScore: number,
  awayScore: number,
) {
  if (homeScore > awayScore) {
    return homeClubId;
  }

  if (awayScore > homeScore) {
    return awayClubId;
  }

  return null;
}

async function ensureLeagueCompetitionWithTeams(competitionId: string) {
  return prisma.competition.findUnique({
    where: {
      id: competitionId,
    },
    include: {
      teams: {
        include: {
          club: {
            select: {
              id: true,
              name: true,
              shortName: true,
              slug: true,
              isActive: true,
            },
          },
        },
      },
    },
  });
}

function ensureClubsAreDifferent(homeClubId: string, awayClubId: string) {
  return homeClubId !== awayClubId;
}

function ensureTeamsAreInCompetition(
  competitionTeams: Array<{ clubId: string }>,
  homeClubId: string,
  awayClubId: string,
) {
  const teamIds = new Set(competitionTeams.map((team) => team.clubId));

  return teamIds.has(homeClubId) && teamIds.has(awayClubId);
}

export async function createLeagueMatch(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getIdParam(req, res, "competitionId");

    if (!competitionId) {
      return;
    }

    const validation = createLeagueMatchSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const data = validation.data;

    const competition = await ensureLeagueCompetitionWithTeams(competitionId);

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: "Competition not found",
        data: null,
      });
    }

    if (competition.type !== "LEAGUE") {
      return res.status(400).json({
        success: false,
        message: "This endpoint only supports league competitions",
        data: {
          competitionType: competition.type,
        },
      });
    }

    if (!ensureClubsAreDifferent(data.homeClubId, data.awayClubId)) {
      return res.status(400).json({
        success: false,
        message: "A club cannot play against itself",
        data: null,
      });
    }

    if (
      !ensureTeamsAreInCompetition(
        competition.teams,
        data.homeClubId,
        data.awayClubId,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Both clubs must be added to the competition before creating a fixture",
        data: null,
      });
    }

    if (data.venueId) {
      const venue = await prisma.venue.findUnique({
        where: {
          id: data.venueId,
        },
      });

      if (!venue) {
        return res.status(404).json({
          success: false,
          message: "Venue not found",
          data: null,
        });
      }
    }

    const match = await prisma.match.create({
      data: {
        competitionId,
        homeClubId: data.homeClubId,
        awayClubId: data.awayClubId,
        scheduledAt: data.scheduledAt,
        matchday: data.matchday,
        venueId: data.venueId,
        status: "SCHEDULED",
      },
      include: {
        competition: {
          select: {
            id: true,
            name: true,
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
        venue: true,
      },
    });

    return res
      .status(201)
      .json(apiResponse("League fixture created successfully", match));
  } catch (error) {
    next(error);
  }
}

export async function getMatches(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId =
      typeof req.query.competitionId === "string"
        ? req.query.competitionId
        : undefined;

    const clubId =
      typeof req.query.clubId === "string" ? req.query.clubId : undefined;

    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;

    const matchday =
      typeof req.query.matchday === "string"
        ? Number(req.query.matchday)
        : undefined;

    const validStatuses = [
      "SCHEDULED",
      "LIVE",
      "COMPLETED",
      "POSTPONED",
      "CANCELLED",
    ];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid match status",
        data: {
          allowedStatuses: validStatuses,
        },
      });
    }

    if (typeof matchday === "number" && Number.isNaN(matchday)) {
      return res.status(400).json({
        success: false,
        message: "matchday must be a valid number",
        data: null,
      });
    }

    const matches = await prisma.match.findMany({
      where: {
        ...(competitionId ? { competitionId } : {}),
        ...(status
          ? {
              status: status as
                | "SCHEDULED"
                | "LIVE"
                | "COMPLETED"
                | "POSTPONED"
                | "CANCELLED",
            }
          : {}),
        ...(typeof matchday === "number" ? { matchday } : {}),
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
          scheduledAt: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    });

    return res
      .status(200)
      .json(apiResponse("Matches fetched successfully", matches));
  } catch (error) {
    next(error);
  }
}

export async function getMatchById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const matchId = getIdParam(req, res);

    if (!matchId) {
      return;
    }

    const match = await prisma.match.findUnique({
      where: {
        id: matchId,
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
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
        data: null,
      });
    }

    return res
      .status(200)
      .json(apiResponse("Match fetched successfully", match));
  } catch (error) {
    next(error);
  }
}

export async function updateLeagueMatch(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const matchId = getIdParam(req, res);

    if (!matchId) {
      return;
    }

    const validation = updateLeagueMatchSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const existingMatch = await prisma.match.findUnique({
      where: {
        id: matchId,
      },
      include: {
        competition: {
          include: {
            teams: true,
          },
        },
      },
    });

    if (!existingMatch) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
        data: null,
      });
    }

    if (existingMatch.competition.type !== "LEAGUE") {
      return res.status(400).json({
        success: false,
        message: "This endpoint only supports league matches",
        data: {
          competitionType: existingMatch.competition.type,
        },
      });
    }

    if (existingMatch.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message:
          "Completed matches cannot be edited here. Submit a corrected result instead.",
        data: null,
      });
    }

    const data = validation.data;

    const finalHomeClubId = data.homeClubId ?? existingMatch.homeClubId;
    const finalAwayClubId = data.awayClubId ?? existingMatch.awayClubId;

    if (!finalHomeClubId || !finalAwayClubId) {
      return res.status(400).json({
        success: false,
        message: "Home club and away club are required",
        data: null,
      });
    }

    if (!ensureClubsAreDifferent(finalHomeClubId, finalAwayClubId)) {
      return res.status(400).json({
        success: false,
        message: "A club cannot play against itself",
        data: null,
      });
    }

    if (
      !ensureTeamsAreInCompetition(
        existingMatch.competition.teams,
        finalHomeClubId,
        finalAwayClubId,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Both clubs must be part of the competition",
        data: null,
      });
    }

    if (data.venueId) {
      const venue = await prisma.venue.findUnique({
        where: {
          id: data.venueId,
        },
      });

      if (!venue) {
        return res.status(404).json({
          success: false,
          message: "Venue not found",
          data: null,
        });
      }
    }

    const match = await prisma.match.update({
      where: {
        id: matchId,
      },
      data: {
        ...(data.homeClubId ? { homeClubId: data.homeClubId } : {}),
        ...(data.awayClubId ? { awayClubId: data.awayClubId } : {}),
        ...(data.scheduledAt ? { scheduledAt: data.scheduledAt } : {}),
        ...(typeof data.matchday === "number"
          ? { matchday: data.matchday }
          : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.venueId !== undefined ? { venueId: data.venueId } : {}),
      },
      include: {
        competition: {
          select: {
            id: true,
            name: true,
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
        venue: true,
      },
    });

    return res
      .status(200)
      .json(apiResponse("League fixture updated successfully", match));
  } catch (error) {
    next(error);
  }
}

export async function submitLeagueResult(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const matchId = getIdParam(req, res);

    if (!matchId) {
      return;
    }

    const validation = submitLeagueResultSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        data: validation.error.flatten().fieldErrors,
      });
    }

    const existingMatch = await prisma.match.findUnique({
      where: {
        id: matchId,
      },
      include: {
        competition: true,
      },
    });

    if (!existingMatch) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
        data: null,
      });
    }

    if (existingMatch.competition.type !== "LEAGUE") {
      return res.status(400).json({
        success: false,
        message: "This endpoint only supports league match results",
        data: {
          competitionType: existingMatch.competition.type,
        },
      });
    }

    if (!existingMatch.homeClubId || !existingMatch.awayClubId) {
      return res.status(400).json({
        success: false,
        message:
          "Match must have home and away clubs before result can be submitted",
        data: null,
      });
    }

    const { homeScore, awayScore } = validation.data;

    const winnerClubId = getWinnerClubId(
      existingMatch.homeClubId,
      existingMatch.awayClubId,
      homeScore,
      awayScore,
    );

    const match = await prisma.match.update({
      where: {
        id: matchId,
      },
      data: {
        homeScore,
        awayScore,
        winnerClubId,
        status: "COMPLETED",
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
    });

    return res
      .status(200)
      .json(apiResponse("League result submitted successfully", match));
  } catch (error) {
    next(error);
  }
}

export async function getLeagueStandings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getIdParam(req, res, "competitionId");

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
              },
            },
          },
        },
        matches: {
          where: {
            status: "COMPLETED",
          },
          select: {
            homeClubId: true,
            awayClubId: true,
            homeScore: true,
            awayScore: true,
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

    if (competition.type !== "LEAGUE") {
      return res.status(400).json({
        success: false,
        message: "Standings are only available for league competitions",
        data: {
          competitionType: competition.type,
        },
      });
    }

    const standingsMap = new Map<string, StandingRow>();

    competition.teams.forEach((team) => {
      standingsMap.set(team.clubId, {
        position: 0,
        clubId: team.club.id,
        clubName: team.club.name,
        shortName: team.club.shortName,
        slug: team.club.slug,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      });
    });

    competition.matches.forEach((match) => {
      if (
        !match.homeClubId ||
        !match.awayClubId ||
        typeof match.homeScore !== "number" ||
        typeof match.awayScore !== "number"
      ) {
        return;
      }

      const homeRow = standingsMap.get(match.homeClubId);
      const awayRow = standingsMap.get(match.awayClubId);

      if (!homeRow || !awayRow) {
        return;
      }

      homeRow.played += 1;
      awayRow.played += 1;

      homeRow.goalsFor += match.homeScore;
      homeRow.goalsAgainst += match.awayScore;

      awayRow.goalsFor += match.awayScore;
      awayRow.goalsAgainst += match.homeScore;

      if (match.homeScore > match.awayScore) {
        homeRow.wins += 1;
        homeRow.points += 3;
        awayRow.losses += 1;
      } else if (match.awayScore > match.homeScore) {
        awayRow.wins += 1;
        awayRow.points += 3;
        homeRow.losses += 1;
      } else {
        homeRow.draws += 1;
        awayRow.draws += 1;
        homeRow.points += 1;
        awayRow.points += 1;
      }
    });

    const standings = Array.from(standingsMap.values())
      .map((row) => ({
        ...row,
        goalDifference: row.goalsFor - row.goalsAgainst,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }

        if (b.goalDifference !== a.goalDifference) {
          return b.goalDifference - a.goalDifference;
        }

        if (b.goalsFor !== a.goalsFor) {
          return b.goalsFor - a.goalsFor;
        }

        return a.clubName.localeCompare(b.clubName);
      })
      .map((row, index) => ({
        ...row,
        position: index + 1,
      }));

    return res.status(200).json(
      apiResponse("League standings calculated successfully", {
        competition: {
          id: competition.id,
          name: competition.name,
          slug: competition.slug,
          type: competition.type,
          status: competition.status,
          season: competition.season,
        },
        standings,
      }),
    );
  } catch (error) {
    next(error);
  }
}
