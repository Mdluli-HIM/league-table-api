import type { CorsOptions } from "cors";
import { allowedCorsOrigins, env } from "./env.js";

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedCorsOrigins.includes("*")) {
      callback(null, true);
      return;
    }

    if (allowedCorsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (env.NODE_ENV === "development") {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
};
