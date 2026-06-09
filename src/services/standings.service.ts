import { prisma } from "../db/prisma.js";

export type StandingRow = {
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

export async function calculateLeagueStandings(competitionId: string) {
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
    return null;
  }

  if (competition.type !== "LEAGUE") {
    return {
      competition,
      standings: null,
    };
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

  return {
    competition,
    standings,
  };
}
