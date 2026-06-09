import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.routes.js";
import { seasonRoutes } from "./routes/season.routes.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { errorMiddleware } from "./middleware/error.middleware.js";

export const app = express();

app.use(helmet());

app.use(
  cors({
    origin: "*",
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "League Table API",
    data: {
      version: "1.0.0",
      docs: `${env.API_PREFIX}/health`,
    },
  });
});

app.use(env.API_PREFIX, healthRoutes);
app.use(env.API_PREFIX, seasonRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
