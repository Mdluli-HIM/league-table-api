import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { apiResponse } from "../utils/api-response.js";
import {
  generateKnockoutBracketSchema,
  submitKnockoutResultSchema,
} from "../validators/tournament.validator.js";

type KnockoutRoundType =
  | "ROUND_OF_64"
  | "ROUND_OF_32"
  | "ROUND_OF_16"
  | "QUARTER_FINAL"
  | "SEMI_FINAL"
  | "FINAL";

type NextMatchSlot = "HOME" | "AWAY";

type RoundConfig = {
  name: string;
  roundType: KnockoutRoundType;
};

const ROUND_CONFIGS: Record<number, RoundConfig[]> = {
  2: [{ name: "Final", roundType: "FINAL" }],
  4: [
    { name: "Semi Final", roundType: "SEMI_FINAL" },
    { name: "Final", roundType: "FINAL" },
  ],
  8: [
    { name: "Quarter Final", roundType: "QUARTER_FINAL" },
    { name: "Semi Final", roundType: "SEMI_FINAL" },
    { name: "Final", roundType: "FINAL" },
  ],
  16: [
    { name: "Round of 16", roundType: "ROUND_OF_16" },
    { name: "Quarter Final", roundType: "QUARTER_FINAL" },
    { name: "Semi Final", roundType: "SEMI_FINAL" },
    { name: "Final", roundType: "FINAL" },
  ],
  32: [
    { name: "Round of 32", roundType: "ROUND_OF_32" },
    { name: "Round of 16", roundType: "ROUND_OF_16" },
    { name: "Quarter Final", roundType: "QUARTER_FINAL" },
    { name: "Semi Final", roundType: "SEMI_FINAL" },
    { name: "Final", roundType: "FINAL" },
  ],
  64: [
    { name: "Round of 64", roundType: "ROUND_OF_64" },
    { name: "Round of 32", roundType: "ROUND_OF_32" },
    { name: "Round of 16", roundType: "ROUND_OF_16" },
    { name: "Quarter Final", roundType: "QUARTER_FINAL" },
    { name: "Semi Final", roundType: "SEMI_FINAL" },
    { name: "Final", roundType: "FINAL" },
  ],
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

function isSupportedKnockoutTeamCount(teamCount: number) {
  return Object.keys(ROUND_CONFIGS).includes(String(teamCount));
}

function getWinnerClubIdFromKnockoutResult({
  homeClubId,
  awayClubId,
  homeScore,
  awayScore,
  homePenaltyScore,
  awayPenaltyScore,
}: {
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
  homePenaltyScore?: number;
  awayPenaltyScore?: number;
}) {
  if (homeScore > awayScore) {
    return homeClubId;
  }

  if (awayScore > homeScore) {
    return awayClubId;
  }

  if (
    typeof homePenaltyScore !== "number" ||
    typeof awayPenaltyScore !== "number"
  ) {
    return null;
  }

  if (homePenaltyScore > awayPenaltyScore) {
    return homeClubId;
  }

  if (awayPenaltyScore > homePenaltyScore) {
    return awayClubId;
  }

  return null;
}

async function getBracketData(competitionId: string) {
  return prisma.competition.findUnique({
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
      _count: {
        select: {
          teams: true,
          rounds: true,
          matches: true,
        },
      },
    },
  });
}

export async function generateKnockoutBracket(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getIdParam(req, res, "competitionId");

    if (!competitionId) {
      return;
    }

    const validation = generateKnockoutBracketSchema.safeParse(req.body ?? {});

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
        teams: {
          include: {
            club: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
        rounds: true,
        matches: true,
      },
    });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: "Competition not found",
        data: null,
      });
    }

    if (competition.type !== "KNOCKOUT") {
      return res.status(400).json({
        success: false,
        message: "This endpoint only supports knockout competitions",
        data: {
          competitionType: competition.type,
        },
      });
    }

    if (competition.rounds.length > 0 || competition.matches.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Bracket has already been generated for this competition",
        data: null,
      });
    }

    const inactiveTeams = competition.teams.filter(
      (team) => !team.club.isActive,
    );

    if (inactiveTeams.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Inactive clubs cannot be included in a bracket",
        data: {
          clubIds: inactiveTeams.map((team) => team.clubId),
        },
      });
    }

    const teamCount = competition.teams.length;

    if (!isSupportedKnockoutTeamCount(teamCount)) {
      return res.status(400).json({
        success: false,
        message:
          "Unsupported team count. Knockout MVP supports 2, 4, 8, 16, 32, or 64 teams.",
        data: {
          teamCount,
          supportedTeamCounts: [2, 4, 8, 16, 32, 64],
        },
      });
    }

    const orderedTeams = [...competition.teams].sort((a, b) => {
      const seedA = a.seed ?? Number.MAX_SAFE_INTEGER;
      const seedB = b.seed ?? Number.MAX_SAFE_INTEGER;

      if (seedA !== seedB) {
        return seedA - seedB;
      }

      return a.club.name.localeCompare(b.club.name);
    });

    const roundConfigs = ROUND_CONFIGS[teamCount];

    if (!roundConfigs) {
      return res.status(400).json({
        success: false,
        message: "Could not resolve knockout rounds for this team count",
        data: {
          teamCount,
        },
      });
    }
    await prisma.$transaction(async (tx) => {
      const createdRounds: Array<{ id: string }> = [];

      for (
        let roundIndex = 0;
        roundIndex < roundConfigs.length;
        roundIndex += 1
      ) {
        const roundConfig = roundConfigs[roundIndex];

        if (!roundConfig) {
          throw new Error("Invalid knockout round configuration");
        }

        const round = await tx.tournamentRound.create({
          data: {
            competitionId,
            name: roundConfig.name,
            roundType: roundConfig.roundType,
            roundOrder: roundIndex + 1,
          },
          select: {
            id: true,
          },
        });

        createdRounds.push(round);
      }

      const matchesByRound: Array<Array<{ id: string }>> = [];

      for (
        let roundIndex = 0;
        roundIndex < createdRounds.length;
        roundIndex += 1
      ) {
        const round = createdRounds[roundIndex];

        if (!round) {
          throw new Error("Invalid knockout round");
        }

        const matchCount = teamCount / 2 ** (roundIndex + 1);
        const roundMatches: Array<{ id: string }> = [];

        for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
          const isFirstRound = roundIndex === 0;

          const homeClubId = isFirstRound
            ? orderedTeams[matchIndex]?.clubId
            : null;

          const awayClubId = isFirstRound
            ? orderedTeams[teamCount - 1 - matchIndex]?.clubId
            : null;

          const match = await tx.match.create({
            data: {
              competitionId,
              roundId: round.id,
              homeClubId,
              awayClubId,
              bracketPosition: matchIndex + 1,
              status: "SCHEDULED",
            },
            select: {
              id: true,
            },
          });

          roundMatches.push(match);
        }

        matchesByRound.push(roundMatches);
      }

      for (
        let roundIndex = 0;
        roundIndex < matchesByRound.length - 1;
        roundIndex += 1
      ) {
        const currentRoundMatches = matchesByRound[roundIndex];
        const nextRoundMatches = matchesByRound[roundIndex + 1];

        if (!currentRoundMatches || !nextRoundMatches) {
          throw new Error("Invalid knockout match progression");
        }

        for (
          let matchIndex = 0;
          matchIndex < currentRoundMatches.length;
          matchIndex += 1
        ) {
          const currentMatch = currentRoundMatches[matchIndex];
          const nextMatch = nextRoundMatches[Math.floor(matchIndex / 2)];

          if (!currentMatch || !nextMatch) {
            throw new Error("Invalid knockout next match link");
          }

          const nextMatchSlot: NextMatchSlot =
            matchIndex % 2 === 0 ? "HOME" : "AWAY";

          await tx.match.update({
            where: {
              id: currentMatch.id,
            },
            data: {
              nextMatchId: nextMatch.id,
              nextMatchSlot,
            },
          });
        }
      }

      await tx.competition.update({
        where: {
          id: competitionId,
        },
        data: {
          status: "ACTIVE",
        },
      });
    });

    const bracket = await getBracketData(competitionId);

    return res
      .status(201)
      .json(apiResponse("Knockout bracket generated successfully", bracket));
  } catch (error) {
    next(error);
  }
}

export async function getKnockoutBracket(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const competitionId = getIdParam(req, res, "competitionId");

    if (!competitionId) {
      return;
    }

    const bracket = await getBracketData(competitionId);

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
      .json(apiResponse("Knockout bracket fetched successfully", bracket));
  } catch (error) {
    next(error);
  }
}

export async function submitKnockoutResult(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const matchId = getIdParam(req, res);

    if (!matchId) {
      return;
    }

    const validation = submitKnockoutResultSchema.safeParse(req.body);

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
        round: true,
        nextMatch: true,
      },
    });

    if (!existingMatch) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
        data: null,
      });
    }

    if (existingMatch.competition.type !== "KNOCKOUT") {
      return res.status(400).json({
        success: false,
        message: "This endpoint only supports knockout match results",
        data: {
          competitionType: existingMatch.competition.type,
        },
      });
    }

    if (!existingMatch.homeClubId || !existingMatch.awayClubId) {
      return res.status(400).json({
        success: false,
        message:
          "Knockout match cannot be completed until both teams are known",
        data: null,
      });
    }

    const { homeScore, awayScore, homePenaltyScore, awayPenaltyScore } =
      validation.data;

    if (
      homeScore === awayScore &&
      (typeof homePenaltyScore !== "number" ||
        typeof awayPenaltyScore !== "number")
    ) {
      return res.status(400).json({
        success: false,
        message: "Penalty scores are required when a knockout match is drawn",
        data: null,
      });
    }

    if (homeScore === awayScore && homePenaltyScore === awayPenaltyScore) {
      return res.status(400).json({
        success: false,
        message: "Penalty scores cannot also be drawn in a knockout match",
        data: null,
      });
    }

    const winnerClubId = getWinnerClubIdFromKnockoutResult({
      homeClubId: existingMatch.homeClubId,
      awayClubId: existingMatch.awayClubId,
      homeScore,
      awayScore,
      homePenaltyScore,
      awayPenaltyScore,
    });

    if (!winnerClubId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine knockout match winner",
        data: null,
      });
    }

    if (existingMatch.nextMatchId && existingMatch.nextMatchSlot) {
      const nextMatch = await prisma.match.findUnique({
        where: {
          id: existingMatch.nextMatchId,
        },
      });

      if (!nextMatch) {
        return res.status(404).json({
          success: false,
          message: "Next match not found",
          data: null,
        });
      }

      const existingNextSlotClubId =
        existingMatch.nextMatchSlot === "HOME"
          ? nextMatch.homeClubId
          : nextMatch.awayClubId;

      const winnerChanged =
        existingMatch.winnerClubId &&
        existingMatch.winnerClubId !== winnerClubId;

      if (
        nextMatch.status === "COMPLETED" &&
        existingNextSlotClubId &&
        winnerChanged
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot change this result because the next round match has already been completed",
          data: null,
        });
      }
    }

    const updatedMatch = await prisma.$transaction(async (tx) => {
      const completedMatch = await tx.match.update({
        where: {
          id: matchId,
        },
        data: {
          homeScore,
          awayScore,
          homePenaltyScore:
            typeof homePenaltyScore === "number" ? homePenaltyScore : null,
          awayPenaltyScore:
            typeof awayPenaltyScore === "number" ? awayPenaltyScore : null,
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
          round: true,
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
        },
      });

      if (existingMatch.nextMatchId && existingMatch.nextMatchSlot) {
        await tx.match.update({
          where: {
            id: existingMatch.nextMatchId,
          },
          data:
            existingMatch.nextMatchSlot === "HOME"
              ? {
                  homeClubId: winnerClubId,
                }
              : {
                  awayClubId: winnerClubId,
                },
        });
      } else {
        await tx.competition.update({
          where: {
            id: existingMatch.competitionId,
          },
          data: {
            status: "COMPLETED",
          },
        });
      }

      return completedMatch;
    });

    return res
      .status(200)
      .json(
        apiResponse("Knockout result submitted successfully", updatedMatch),
      );
  } catch (error) {
    next(error);
  }
}
