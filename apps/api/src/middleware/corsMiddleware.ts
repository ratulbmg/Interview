import cors, { CorsOptions } from "cors";

const allowedOrigins = [
  `http://localhost:${process.env.DASHBOARD_PORT ?? 3002}`,
  // Replace with the dashboard's real domain once deployed.
];

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
};

// More permissive in dev so the Vite dashboard (any local port) always works.
const devCorsOptions: CorsOptions = {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: "*",
};

export const corsMiddleware =
  process.env.API_NODE_ENV === "production"
    ? cors(corsOptions)
    : cors(devCorsOptions);

export default corsMiddleware;
