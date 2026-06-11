import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function ensureSeason() {
  const name = "2026 League Season";
  const slug = slugify(name);

  await prisma.season.updateMany({
    where: {
      isCurrent: true,
    },
    data: {
      isCurrent: false,
    },
  });

  const existing = await prisma.season.findFirst({
    where: {
      slug,
    },
  });

  if (existing) {
    return prisma.season.update({
      where: {
        id: existing.id,
      },
      data: {
        name,
        slug,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        status: "ACTIVE",
        isCurrent: true,
      },
    });
  }

  return prisma.season.create({
    data: {
      name,
      slug,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: "ACTIVE",
      isCurrent: true,
    },
  });
}

async function ensureClub(name: string, shortName: string) {
  const slug = slugify(name);

  const existing = await prisma.club.findFirst({
    where: {
      slug,
    },
  });

  if (existing) {
    return prisma.club.update({
      where: {
        id: existing.id,
      },
      data: {
        name,
        shortName,
        slug,
        isActive: true,
      },
    });
  }

  return prisma.club.create({
    data: {
      name,
      shortName,
      slug,
      isActive: true,
    },
  });
}

async function ensureVenue() {
  const name = "Main Stadium";

  const existing = await prisma.venue.findFirst({
    where: {
      name,
    },
  });

  if (existing) {
    return prisma.venue.update({
      where: {
        id: existing.id,
      },
      data: {
        name,
        address: "Pretoria, Gauteng",
        isActive: true,
      },
    });
  }

  return prisma.venue.create({
    data: {
      name,
      address: "Pretoria, Gauteng",
      isActive: true,
    },
  });
}

async function ensureCompetition(seasonId: string) {
  const name = "Premier League";
  const slug = slugify(name);

  const existing = await prisma.competition.findFirst({
    where: {
      slug,
      seasonId,
    },
  });

  if (existing) {
    return prisma.competition.update({
      where: {
        id: existing.id,
      },
      data: {
        name,
        slug,
        type: "LEAGUE",
        status: "ACTIVE",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-11-30"),
      },
    });
  }

  return prisma.competition.create({
    data: {
      name,
      slug,
      seasonId,
      type: "LEAGUE",
      status: "ACTIVE",
      startDate: new Date("2026-01-15"),
      endDate: new Date("2026-11-30"),
    },
  });
}

async function main() {
  const season = await ensureSeason();

  const clubs = await Promise.all([
    ensureClub("Mamelodi FC", "MFC"),
    ensureClub("Pretoria Stars", "PRS"),
    ensureClub("Arcadia United", "ARC"),
    ensureClub("Capital Rovers", "CAP"),
    ensureClub("Soshanguve City", "SOS"),
    ensureClub("Tshwane Athletic", "TSH"),
  ]);

  await prisma.club.updateMany({
    where: {
      id: {
        notIn: clubs.map((club) => club.id),
      },
    },
    data: {
      isActive: false,
    },
  });

  const venue = await ensureVenue();
  const competition = await ensureCompetition(season.id);

  await prisma.match.deleteMany({
    where: {
      competitionId: competition.id,
    },
  });

  await prisma.competitionTeam.deleteMany({
    where: {
      competitionId: competition.id,
    },
  });

  await prisma.competitionTeam.createMany({
    data: clubs.map((club, index) => ({
      competitionId: competition.id,
      clubId: club.id,
      seed: index + 1,
    })),
    skipDuplicates: true,
  });

  const [mamelodi, pretoria, arcadia, capital, soshanguve, tshwane] = clubs;

  if (
    !mamelodi ||
    !pretoria ||
    !arcadia ||
    !capital ||
    !soshanguve ||
    !tshwane
  ) {
    throw new Error("Demo clubs were not created correctly.");
  }

  await prisma.match.createMany({
    data: [
      {
        competitionId: competition.id,
        homeClubId: mamelodi.id,
        awayClubId: pretoria.id,
        venueId: venue.id,
        scheduledAt: new Date("2026-04-01T15:00:00.000Z"),
        status: "COMPLETED",
        homeScore: 2,
        awayScore: 1,
      },
      {
        competitionId: competition.id,
        homeClubId: arcadia.id,
        awayClubId: capital.id,
        venueId: venue.id,
        scheduledAt: new Date("2026-04-02T18:00:00.000Z"),
        status: "COMPLETED",
        homeScore: 1,
        awayScore: 1,
      },
      {
        competitionId: competition.id,
        homeClubId: soshanguve.id,
        awayClubId: tshwane.id,
        venueId: venue.id,
        scheduledAt: new Date("2026-04-03T15:00:00.000Z"),
        status: "COMPLETED",
        homeScore: 0,
        awayScore: 3,
      },
      {
        competitionId: competition.id,
        homeClubId: mamelodi.id,
        awayClubId: arcadia.id,
        venueId: venue.id,
        scheduledAt: new Date("2026-04-08T15:00:00.000Z"),
        status: "COMPLETED",
        homeScore: 4,
        awayScore: 0,
      },
      {
        competitionId: competition.id,
        homeClubId: pretoria.id,
        awayClubId: soshanguve.id,
        venueId: venue.id,
        scheduledAt: new Date("2026-04-09T18:00:00.000Z"),
        status: "COMPLETED",
        homeScore: 2,
        awayScore: 2,
      },
      {
        competitionId: competition.id,
        homeClubId: capital.id,
        awayClubId: tshwane.id,
        venueId: venue.id,
        scheduledAt: new Date("2026-04-10T15:00:00.000Z"),
        status: "COMPLETED",
        homeScore: 1,
        awayScore: 0,
      },
      {
        competitionId: competition.id,
        homeClubId: mamelodi.id,
        awayClubId: capital.id,
        venueId: venue.id,
        scheduledAt: new Date("2026-06-20T15:00:00.000Z"),
        status: "SCHEDULED",
      },
      {
        competitionId: competition.id,
        homeClubId: pretoria.id,
        awayClubId: tshwane.id,
        venueId: venue.id,
        scheduledAt: new Date("2026-06-21T15:00:00.000Z"),
        status: "SCHEDULED",
      },
      {
        competitionId: competition.id,
        homeClubId: arcadia.id,
        awayClubId: soshanguve.id,
        venueId: venue.id,
        scheduledAt: new Date("2026-06-22T18:00:00.000Z"),
        status: "SCHEDULED",
      },
    ],
  });

  console.log("Demo league data seeded successfully:");
  console.log({
    season: season.name,
    competition: competition.name,
    clubs: clubs.length,
    venue: venue.name,
    completedMatches: 6,
    scheduledFixtures: 3,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
