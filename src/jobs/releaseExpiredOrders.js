import cron from "node-cron";
import { prisma } from "../db/prisma.js";
import { getNowInWIB } from "../utils/timezone.js";

const PAYMENT_TIMEOUT_HOURS = 24;

export function startReleaseExpiredOrdersJob() {
  cron.schedule("*/10 * * * *", async () => {
    console.log("⏱️ Checking expired orders...");

    const expiredAt = new Date(Date.now() - PAYMENT_TIMEOUT_HOURS * 60 * 60 * 1000);

    const expiredOrders = await prisma.order.findMany({
      where: {
        status: "pending_payment",
        createdAt: { lt: expiredAt },
      },
      select: { orderId: true },
    });

    if (expiredOrders.length === 0) return;

    const orderIds = expiredOrders.map((o) => o.orderId);

    await prisma.$transaction(async (tx) => {
      // release books
      await tx.couponBook.updateMany({
        where: { orderId: { in: orderIds } },
        data: {
          orderId: null,
          assignedAt: null,
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
