import { prisma } from "../db/prisma.js";
import { findFileByName, downloadFile } from "../services/googleDriveService.js";
import { mergePdfs } from "../services/pdfService.js";

// GET /api/admin/stats
export async function getDashboardStats(req, res) {
  try {
    const [
      availableBooks,
      soldBooks,
      pendingVerificationOrders,
      pendingPaymentOrders
    ] = await prisma.$transaction([
      // 1. Available Books (not assigned to any order)
      prisma.couponBook.count({
        where: { orderId: null }
      }),
      // 2. Sold Books (Books assigned to orders that are Verified)
      prisma.couponBook.count({
        where: {
          order: {
            status: 'verified'
          }
        }
      }),
      // 3. Pending Verification Orders
      prisma.order.count({
        where: { status: 'pending_verification' }
      }),
      // 4. Pending Payment Orders
      prisma.order.count({
        where: { status: 'pending_payment' }
      })
    ]);

    res.json({
      data: {
        availableBooks,
        soldBooks,
        pendingVerificationOrders,
        pendingPaymentOrders
      }
    });
  } catch (error) {
    console.error("getDashboardStats error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
}

// GET /api/admin/orders
export async function getAllOrders(req, res) {
  try {
    const { page = 1, limit = 10, status, search, sort = 'desc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (status) { // Expecting comma separated or single status, usually single for filter
      // If frontend sends 'all' or empty, we don't query status.
      // User requirement says "filter".
      where.status = status;
    }
    if (search) {
      where.OR = [
        { orderId: { contains: search, mode: 'insensitive' } },
        // Prisma relation filtering for search
        { customer: { namaLengkap: { contains: search, mode: 'insensitive' } } },
        { customer: { nomorWhatsApp: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: sort === 'asc' ? 'asc' : 'desc' },
        include: {
          customer: {
            include: {
              wilayah: true,
              gereja: true
            }
          },
          payments: true
        }
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      data: orders,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error("getAllOrders error:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
}

// GET /api/admin/orders/:orderId
export async function getOrderById(req, res) {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: {
        customer: {
          include: {
            wilayah: true,
            gereja: true
          }
        },
        payments: true,
        couponBooks: true
      }
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ data: order });
  } catch (error) {
    console.error("getOrderById error:", error);
    res.status(500).json({ message: "Failed to fetch order details" });
  }
}

// POST /api/admin/orders/:orderId/verify
export async function verifyOrder(req, res) {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({ where: { orderId } });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== 'pending_verification') {
      return res.status(400).json({ message: "Order cannot be verified (invalid status)" });
    }

    const updatedOrder = await prisma.order.update({
      where: { orderId },
      data: { status: "verified" }
    });

    res.json({ message: "Order verified successfully", data: updatedOrder });
  } catch (error) {
    console.error("verifyOrder error:", error);
    res.status(500).json({ message: "Failed to verify order" });
  }
}

// POST /api/admin/orders/:orderId/reject
export async function rejectOrder(req, res) {
  try {
    const { orderId } = req.params;

    // Transaction to update order status and release books
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { orderId } });
      if (!order) throw new Error("Order not found");

      // Allow rejection if pending_payment or pending_verification
      if (!['pending_payment', 'pending_verification'].includes(order.status)) {
        throw new Error("Order cannot be rejected (invalid status)");
      }

      // 1. Update Order Status
      await tx.order.update({
        where: { orderId },
        data: { status: 'cancelled' }
      });

      // 2. Release Books (unlink orderId)
      await tx.couponBook.updateMany({
        where: { orderId },
        data: {
          orderId: null,
          assignedAt: null
        }
      });
    });

    res.json({ message: "Order rejected and coupons released" });
  } catch (error) {
    console.error("rejectOrder error:", error);
    res.status(400).json({ message: error.message || "Failed to reject order" });
  }
}

// POST /api/admin/orders/:orderId/merge-pdf
export async function mergeOrderPdfs(req, res) {
  try {
    const { orderId } = req.params;

    // 1. Fetch Order with CouponBooks
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: {
        couponBooks: true
      }
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // 2. Validate Order Status (Verified = Paid)
    // "Assume the order is already validated as PAID" - Enforcing verified for safety
    // if (order.status !== 'verified') {
    //     return res.status(400).json({ message: "Order must be verified to merge PDFs" });
    // }

    if (!order.couponBooks || order.couponBooks.length === 0) {
      return res.status(400).json({ message: "No coupon books assigned to this order" });
    }

    // 3. Sort CouponBooks by bookCode
    const sortedBooks = order.couponBooks.sort((a, b) => 
      a.bookCode.localeCompare(b.bookCode)
    );

    const pdfBuffers = [];

    // 4. Download PDFs from Google Drive
    for (const book of sortedBooks) {
      const fileName = `${book.bookCode}.pdf`; // Assuming PDF extension
      const file = await findFileByName(fileName);

      if (!file) {
        console.warn(`PDF not found for book: ${fileName}`);
        return res.status(404).json({ message: `PDF file not found in Google Drive: ${fileName}` });
      }

      const buffer = await downloadFile(file.id);
      pdfBuffers.push(buffer);
    }

    // 5. Merge PDFs
    if (pdfBuffers.length === 0) {
        return res.status(400).json({ message: "No PDFs found to merge" });
    }

    const mergedPdfBuffer = await mergePdfs(pdfBuffers);

    // 6. Return Response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="merged-order-${orderId}.pdf"`);
    res.send(mergedPdfBuffer);

  } catch (error) {
    console.error("mergeOrderPdfs error:", error);
    res.status(500).json({ message: "Failed to merge PDFs" });
  }
}
