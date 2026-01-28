// Orders Controller
// Handles order creation and retrieval
import { prisma } from "../db/prisma.js";
import { validateCreateOrder } from "../utils/validators.js";
import { nanoid } from "nanoid";
import { getNowInWIB } from "../utils/timezone.js";

const PRICE_PER_BOOK = 100000;
const PAYMENT_TIMEOUT_MINUTES = 30;

/**
 * POST /api/orders
 * Body:
 * {
 *   selectedBooks: string[],
 *   customer: {
 *     namaLengkap: string,
 *     nomorWhatsApp: string,
 *     asalPembeli: "GPIB" | "UMUM",
 *     wilayahId?: number,
 *     gerejaId?: number
 *   }
 * }
 */

export async function createOrder(req, res) {
  try {
    const { selectedBooks, customer } = req.body;

    const orderId = `ORD-${Date.now()}-${nanoid(4)}`;
    const bookCount = selectedBooks.length;

    const baseAmount = bookCount * PRICE_PER_BOOK;
    const uniqueCode = generateUniqueCode();
    const payableAmount = baseAmount + uniqueCode;

    const order = await prisma.$transaction(async (tx) => {
      // 1️⃣ Check availability
      const available = await tx.couponBook.findMany({
        where: {
          bookCode: { in: selectedBooks },
          orderId: null,
        },
        select: { bookCode: true },
      });
      //todo: buat message yang lebih informatif tentang buku yang tidak tersedia
      if (available.length !== selectedBooks.length) {
        throw new Error("Salah satu buku sudah tidak tersedia");
      }

      // 2️⃣ Create order + customer
      const expiresAt = new Date(Date.now() + PAYMENT_TIMEOUT_MINUTES * 60 * 1000);
      const createdOrder = await tx.order.create({
        data: {
          orderId,
          bookCount,
          totalAmount: baseAmount,
          uniqueCode,
          payabyleAmount: payableAmount,
          payabyleAmount: payableAmount,
          status: "pending_payment",
          expiresAt,
          paymentToken: nanoid(32),
          customer: {
            create: {
              namaLengkap: customer.namaLengkap,
              nomorWhatsApp: customer.nomorWhatsApp,
              asalPembeli: customer.asalPembeli,
              wilayahId: customer.wilayahId ?? null,
              gerejaId: customer.gerejaId ?? null,
            },
          },
        },
        include: {
          customer: true,
        },
      });
      // 3️⃣ Lock selected books
      await tx.couponBook.updateMany({
        where: {
          bookCode: { in: selectedBooks },
          orderId: null,
        },
        data: {
          orderId: createdOrder.orderId,
          assignedAt: getNowInWIB(),
        },
      });

      return createdOrder;
    });

    return res.status(201).json({
      message: "Order berhasil dibuat",
      data: {
        orderId: order.orderId,
        bookCount: order.bookCount,
        totalAmount: order.totalAmount,
        uniqueCode: order.uniqueCode,
        payabyleAmount: order.payabyleAmount,
        payabyleAmount: order.payabyleAmount,
        expiresAt: order.expiresAt,
        status: order.status,
        paymentToken: order.paymentToken,
        selectedBooks,
        customer: order.customer,
      },
    });
  } catch (error) {
    console.error("createOrder error:", error);

    return res.status(400).json({
      message: error.message || "Gagal membuat order",
    });
  }
}

function generateUniqueCode() {
  return Math.floor(100 + Math.random() * 900); // 100–999
}

export async function getOrder(req, res) {
  const { orderId } = req.params;
  const { token } = req.query; // Expect token from query string

  try {
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { customer: true },
    });

    if (!order) {
      return res.status(404).json({ message: "Order tidak ditemukan" });
    }

    // Security Check: If order has a paymentToken, require it to match
    if (order.paymentToken && order.paymentToken !== token) {
      return res.status(403).json({ message: "Akses ditolak. Token pembayaran tidak valid." });
    }

    res.json({ message: "Order details", order });
  } catch (error) {
    console.error("getOrder error:", error);
    res.status(500).json({ message: "Gagal memuat data order" });
  }
}

export async function cancelOrder(req, res) {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { orderId },
      select: { status: true },
    });

    if (!order) {
      return res.status(404).json({ message: "Order tidak ditemukan" });
    }

    if (order.status !== "pending_payment") {
      return res.status(400).json({ message: "Order tidak dapat dibatalkan" });
    }

    await prisma.$transaction(async (tx) => {
      // Release all coupon books associated with this order
      await tx.couponBook.updateMany({
        where: { orderId },
        data: {
          orderId: null,
          assignedAt: null,
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      // Cancel the order
      await tx.order.update({
        where: { orderId },
        data: { status: "cancelled" },
      });
    });

    return res.json({ message: "Order berhasil dibatalkan" });
  } catch (error) {
    console.error("cancelOrder error:", error);
    return res.status(500).json({ message: "Gagal membatalkan order" });
  }
}
