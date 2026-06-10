import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { corsOptions } from "./config/cors.js";

import { healthRoutes } from "./routes/health.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { publicRoutes } from "./routes/public.routes.js";
import { seasonRoutes } from "./routes/season.routes.js";
import { clubRoutes } from "./routes/club.routes.js";
import { competitionRoutes } from "./routes/competition.routes.js";
import { playerRoutes } from "./routes/player.routes.js";
import { matchRoutes } from "./routes/match.routes.js";
import { tournamentRoutes } from "./routes/tournament.routes.js";
import { adminDashboardRoutes } from "./routes/admin-dashboard.routes.js";

import { apiRateLimiter } from "./middleware/rate-limit.middleware.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { errorMiddleware } from "./middleware/error.middleware.js";

export const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

app.use(cors(corsOptions));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "League Table API",
    data: {
      version: "1.0.0",
      environment: env.NODE_ENV,
      health: `${env.API_PREFIX}/health`,
      public: {
        home: `${env.API_PREFIX}/public/home`,
        clubs: `${env.API_PREFIX}/public/clubs`,
        fixtures: `${env.API_PREFIX}/public/fixtures`,
        results: `${env.API_PREFIX}/public/results`,
        competitions: `${env.API_PREFIX}/public/competitions`,
      },
    },
  });
});

app.use(env.API_PREFIX, healthRoutes);

app.use(env.API_PREFIX, apiRateLimiter);

app.use(env.API_PREFIX, authRoutes);
app.use(env.API_PREFIX, publicRoutes);

app.use(env.API_PREFIX, requireAuth);

app.use(env.API_PREFIX, adminDashboardRoutes);
app.use(env.API_PREFIX, seasonRoutes);
app.use(env.API_PREFIX, clubRoutes);
app.use(env.API_PREFIX, competitionRoutes);
app.use(env.API_PREFIX, playerRoutes);
app.use(env.API_PREFIX, matchRoutes);
app.use(env.API_PREFIX, tournamentRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);
