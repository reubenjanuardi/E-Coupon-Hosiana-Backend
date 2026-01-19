import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import ordersRouter from "./routes/orders.js";
import paymentsRouter from "./routes/payments.js";
import adminRouter from "./routes/admin.js";
import authRouter from "./routes/auth.js";
import verificationRouter from "./routes/verification.js";
import churchesRoutes from "./routes/churches.js";
import couponsRouter from "./routes/coupons.js";
import { authenticateToken } from "./middlewares/auth.middleware.js";

const app = express();

// Security Headers
app.use(helmet());

// Global Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Login Rate Limiter (Stricter)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many login attempts from this IP, please try again after 15 minutes",
});

// CORS configuration based on environment
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim().replace(/\/$/, "")) // Remove trailing slash
  : ["*"]; // Default to all origins in development

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or same-origin)
      if (!origin) return callback(null, true);

      // If allowedOrigins includes '*', allow all origins
      if (allowedOrigins.includes("*")) return callback(null, true);

      // Check if the origin is in the allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Required for cookies
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
  })
);
app.use(express.json());
app.use(cookieParser());

// Auth routes (Apply stricter limit to login)
app.use("/api/auth/login", loginLimiter); // Apply only to login
app.use("/api/auth", authRouter);

// Public routes
app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/verification", verificationRouter);
app.use("/api/public", churchesRoutes);
app.use("/api/coupons", couponsRouter);

// Admin routes (Protected)
app.use("/api/admin", authenticateToken, adminRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

export default app;
