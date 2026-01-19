import app from "./app.js";
import { startReleaseExpiredOrdersJob } from "./jobs/releaseExpiredOrders.js";
import { prisma } from "./db/prisma.js";
import dotenv from "dotenv";

// Set timezone to UTC+7 (WIB - Waktu Indonesia Barat)
process.env.TZ = "Asia/Jakarta";

dotenv.config();

const PORT = process.env.PORT || 4000;

// Start the server
const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Test database connection
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");
    
    // Start cron jobs after database is connected
    startReleaseExpiredOrdersJob();
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    // Don't exit - let the app handle requests that don't need DB
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await prisma.$disconnect();
    process.exit(0);
  });
});
