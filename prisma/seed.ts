import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const name = process.env.DEFAULT_ADMIN_NAME ?? "Admin User";
  const email = process.env.DEFAULT_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!email) {
    throw new Error("DEFAULT_ADMIN_EMAIL is required");
  }

  if (!password || password.length < 8) {
    throw new Error("DEFAULT_ADMIN_PASSWORD must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.upsert({
    where: {
      email,
    },
    create: {
      name,
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
    update: {},
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  console.log("Seeded admin user:");
  console.log(admin);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
