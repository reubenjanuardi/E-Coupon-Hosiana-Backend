// Orders Controller
// Handles order creation and retrieval
import { prisma } from "../db/prisma.js";
import { validateCreateOrder } from "../utils/validators.js";
import { nanoid } from "nanoid";
import { getNowInWIB } from "../utils/timezone.js";

const PRICE_PER_BOOK = 100000;

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
      const createdOrder = await tx.order.create({
        data: {
          orderId,
          bookCount,
          totalAmount: baseAmount,
          uniqueCode,
          payabyleAmount: payableAmount,
          status: "pending_payment",
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
        status: order.status,
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
  // TODO: Fetch order details from database using Prisma
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { customer: true },
  });

  res.json({ message: "Order details", order });
}
