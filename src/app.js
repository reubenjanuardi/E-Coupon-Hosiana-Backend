import express from "express";
import cors from "cors";
import ordersRouter from "./routes/orders.js";
import paymentsRouter from "./routes/payments.js";
import adminRouter from "./routes/admin.js";
import verificationRouter from "./routes/verification.js";
import churchesRoutes from "./routes/churches.js";
import couponsRouter from "./routes/coupons.js";

const app = express();

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
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Public routes
app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/verification", verificationRouter); // Changed from /api/verify to /api/verification
app.use("/api/public", churchesRoutes);
app.use("/api/coupons", couponsRouter);

// Admin routes
app.use("/api/admin", adminRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

export default app;
