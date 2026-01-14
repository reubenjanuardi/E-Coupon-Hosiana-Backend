import cron from "node-cron";
import { prisma } from "../db/prisma.js";
import { getNowInWIB } from "../utils/timezone.js";

export function startReleaseExpiredOrdersJob() {
  // Run every minute to ensure timely cancellation
  cron.schedule("* * * * *", async () => {
    console.log("⏱️ Checking expired orders...");

    const now = new Date();

    const expiredOrders = await prisma.order.findMany({
      where: {
        status: "pending_payment",
        expiresAt: { lt: now }, // Orders where expiresAt is in the past
      },
      select: { orderId: true },
    });

    if (expiredOrders.length === 0) return;

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
  });
}

