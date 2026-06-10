import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { apiResponse } from "../utils/api-response.js";

export async function getAdminDashboardSummary(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const [
      totalSeasons,
      totalClubs,
      activeClubs,
      totalPlayers,
      totalPlayerRegistrations,
      totalCompetitions,
      totalLeagueCompetitions,
      totalKnockoutCompetitions,
      activeCompetitionsCount,
      scheduledFixturesCount,
      completedMatchesCount,
      currentSeason,
      activeCompetitions,
      upcomingFixtures,
      recentResults,
      latestPlayerRegistrations,
    ] = await prisma.$transaction([
      prisma.season.count(),

      prisma.club.count(),

      prisma.club.count({
        where: {
          isActive: true,
        },
      }),

      prisma.player.count(),

      prisma.playerRegistration.count(),

      prisma.competition.count(),

      prisma.competition.count({
        where: {
          type: "LEAGUE",
        },
      }),

      prisma.competition.count({
        where: {
          type: "KNOCKOUT",
        },
      }),

      prisma.competition.count({
        where: {
          status: "ACTIVE",
        },
      }),

      prisma.match.count({
        where: {
          status: "SCHEDULED",
        },
      }),

      prisma.match.count({
        where: {
          status: "COMPLETED",
        },
      }),

      prisma.season.findFirst({
        where: {
          isCurrent: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          startDate: true,
          endDate: true,
          status: true,
          isCurrent: true,
          _count: {
            select: {
              competitions: true,
              playerRegistrations: true,
            },
          },
        },
      }),

      prisma.competition.findMany({
        where: {
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          status: true,
          startDate: true,
          endDate: true,
          season: {
            select: {
              id: true,
              name: true,
              slug: true,
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
          updatedAt: "desc",
        },
        take: 5,
      }),

      prisma.match.findMany({
        where: {
          status: "SCHEDULED",
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
      }),

      prisma.match.findMany({
        where: {
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
        orderBy: {
          updatedAt: "desc",
        },
        take: 5,
      }),

      prisma.playerRegistration.findMany({
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
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      }),
    ]);

    return res.status(200).json(
      apiResponse("Admin dashboard summary fetched successfully", {
        stats: {
          totalSeasons,
          totalClubs,
          activeClubs,
          inactiveClubs: totalClubs - activeClubs,
          totalPlayers,
          totalPlayerRegistrations,
          totalCompetitions,
          totalLeagueCompetitions,
          totalKnockoutCompetitions,
          activeCompetitions: activeCompetitionsCount,
          scheduledFixtures: scheduledFixturesCount,
          completedMatches: completedMatchesCount,
        },
        currentSeason,
        activeCompetitions,
        upcomingFixtures,
        recentResults,
        latestPlayerRegistrations,
      }),
    );
  } catch (error) {
    next(error);
  }
}
