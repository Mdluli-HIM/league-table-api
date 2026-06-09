import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().default(5050),

  API_PREFIX: z.string().default("/api/v1"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),

  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(300),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables:");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;

export const allowedCorsOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
