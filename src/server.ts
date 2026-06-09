import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";

const server = app.listen(env.PORT, () => {
  console.log(`League Table API running on port ${env.PORT}`);
  console.log(
    `Health check: http://localhost:${env.PORT}${env.API_PREFIX}/health`,
  );
});

async function shutdown() {
  console.log("Shutting down server...");

  await prisma.$disconnect();

  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
