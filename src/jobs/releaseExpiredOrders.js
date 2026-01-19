import cron from "node-cron";
import { prisma } from "../db/prisma.js";
import { getNowInWIB } from "../utils/timezone.js";

export function startReleaseExpiredOrdersJob() {
  // Run every minute to ensure timely cancellation
  cron.schedule("* * * * *", async () => {
    try {
      console.log("⏱️ Checking expired orders...");

      const now = new Date();
      const expiryTime = 24 * 60 * 60 * 1000; // 24 Hours
      const cutoffDate = new Date(now.getTime() - expiryTime);

      const expiredOrders = await prisma.order.findMany({
        where: {
          status: "pending_payment",
          createdAt: { lt: cutoffDate },
        },
        select: { orderId: true },
      });

      if (expiredOrders.length === 0) {
        console.log("✅ No expired orders found");
        return;
      }

      const orderIds = expiredOrders.map((o) => o.orderId);

      await prisma.$transaction(async (tx) => {
        // release books and clear all lock fields
        await tx.couponBook.updateMany({
          where: { orderId: { in: orderIds } },
          data: {
            orderId: null,
            assignedAt: null,
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null,
          },
        });

        // cancel orders
        await tx.order.updateMany({
          where: { orderId: { in: orderIds } },
          data: { status: "cancelled" },
        });
      });

      console.log(`✅ Released ${orderIds.length} expired orders`);
    } catch (error) {
      console.error("❌ Error in releaseExpiredOrders job:", error.message);
      // Don't throw - let the cron job continue
    }
  });
  
  console.log("🔄 Release expired orders job started");
}

