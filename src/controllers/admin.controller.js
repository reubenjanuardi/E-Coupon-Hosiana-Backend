import { prisma } from "../db/prisma.js";
import { findFileByName, downloadFile } from "../services/googleDriveService.js";
import { mergePdfs } from "../services/pdfService.js";

// GET /api/admin/stats
export async function getDashboardStats(req, res) {
  try {
    const [
      availableBooks,
      soldBooksAgg,
      pendingVerificationOrders,
      pendingPaymentOrders
    ] = await Promise.all([
      // 1. Available Books (not assigned to any order)
      prisma.couponBook.count({
        where: { orderId: null }
      }),
      // 2. Sold Books (Sum of bookCount from orders that are Verified, Merged, or Sent)
      // OPTIMIZATION: Use aggregate on Order table instead of counting CouponBooks with join
      prisma.order.aggregate({
        _sum: { bookCount: true },
        where: {
          status: { in: ['verified', 'MERGED', 'SENT'] }
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
        soldBooks: soldBooksAgg._sum.bookCount || 0, // Handle null result if no orders match
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

    const [orders, total] = await Promise.all([
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
    if (order.status !== 'verified') {
      return res.status(400).json({ message: "Order must be verified to merge PDFs" });
    }

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

    // 6. Update Order Status (NEW)
    await prisma.order.update({
      where: { orderId },
      data: {
        status: 'MERGED',
        mergedAt: new Date()
      }
    });

    // 7. Return Response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="merged-order-${orderId}.pdf"`);
    res.send(mergedPdfBuffer);

  } catch (error) {
    console.error("mergeOrderPdfs error:", error);
    res.status(500).json({ message: "Failed to merge PDFs" });
  }
}

// POST /api/admin/orders/:orderId/mark-sent
export async function markOrderSent(req, res) {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({ where: { orderId } });
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Ensure strict flow: MERGED -> SENT
    if (order.status !== 'MERGED') {
      return res.status(400).json({ message: "Order must be in MERGED status to be marked as SENT" });
    }

    const updatedOrder = await prisma.order.update({
      where: { orderId },
      data: {
        status: 'SENT',
        sentAt: new Date()
      }
    });

    res.json({ message: "Order marked as SENT", data: updatedOrder });
  } catch (error) {
    console.error("markOrderSent error:", error);
    res.status(500).json({ message: "Failed to mark order as sent" });
  }
}

// GET /api/admin/orders/:orderId/whatsapp-message
export async function getWhatsAppMessage(req, res) {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { orderId },
      include: {
        customer: {
          include: {
            gereja: true,
            wilayah: true
          }
        },
        couponBooks: true
      }
    });

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.customer) return res.status(404).json({ message: "Customer data missing" });

    const customer = order.customer;
    const books = order.couponBooks || [];
    
    // Sort books
    const sortedBooks = books.sort((a, b) => a.bookCode.localeCompare(b.bookCode));
    const bookCodes = sortedBooks.map(b => b.bookCode).join(', ');
    const count = sortedBooks.length;

    // Construct Message
    // You can customize this template
    const message = `Halo ${customer.namaLengkap},

Terima kasih telah berpartisipasi dalam E-Coupon.
Berikut adalah E-Coupon/Buku Kupon digital Anda:

Order ID: ${order.orderId}
Jumlah Buku: ${count}
Kode Buku: ${bookCodes || '-'}

Silakan dicek lampiran PDF berikut.`;

    res.json({
      data: {
        phoneNumber: customer.nomorWhatsApp, // Frontend can sanitize this if needed
        message: message
      }
    });


  } catch (error) {
    console.error("getWhatsAppMessage error:", error);
    res.status(500).json({ message: "Failed to generate WhatsApp message" });
  }
}

// POST /api/admin/orders
export async function createOrder(req, res) {
  try {
    const { 
        customerName, 
        customerWhatsApp, 
        asalPembeli, // 'GPIB' or 'UMUM'
        wilayahId, 
        gerejaId, 
        bookCount, 
        totalAmount, 
        uniqueCode, 
        payabyleAmount 
    } = req.body;

    // Validate Status Enum (Validating input is good practice)
    if (!['GPIB', 'UMUM'].includes(asalPembeli)) {
         return res.status(400).json({ message: "Invalid asalPembeli. Must be GPIB or UMUM" });
    }

    // Generate Order ID (using valid nanoid or similar if available, or just timestamp + random)
    // Looking at other code, orderId seems to be string. Let's use simple generation for now or import nanoid if used elsewhere.
    // Checking package.json... nanoid is there.
    
    // Import nanoid dynamically if not top-level, or use helper. 
    // Since I can't easily see imports at top without reading file again, I'll rely on what's available or use Date.now().
    // Actually, let's use a simple ID generator to be safe or assuming nanoid is imported or I can import it.
    // I'll stick to a simple numeric/string ID for now to avoid import issues, or better, check how orderId is generated usually.
    // It seems previously it might be generated by frontend or backend.
    // Let's assume backend generation.

    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const result = await prisma.$transaction(async (tx) => {
        // 1. Create Order
        const newOrder = await tx.order.create({
            data: {
                orderId,
                bookCount: parseInt(bookCount),
                totalAmount: parseInt(totalAmount),
                uniqueCode: parseInt(uniqueCode) || 0,
                payabyleAmount: parseInt(payabyleAmount),
                status: 'pending_payment',
                customer: {
                    create: {
                        namaLengkap: customerName,
                        nomorWhatsApp: customerWhatsApp,
                        asalPembeli,
                        wilayahId: wilayahId ? parseInt(wilayahId) : null,
                        gerejaId: gerejaId ? parseInt(gerejaId) : null
                    }
                }
            },
            include: {
                customer: true
            }
        });

        return newOrder;
    });

    res.status(201).json({ message: "Order created successfully", data: result });
  } catch (error) {
    console.error("createOrder error:", error);
    res.status(500).json({ message: "Failed to create order" });
  }
}

// PUT /api/admin/orders/:orderId
export async function updateOrder(req, res) {
  try {
    const { orderId } = req.params;
    const { 
        customerName, 
        customerWhatsApp,
        status,
        // Add other fields as needed
    } = req.body;

    const dataToUpdate = {};
    if (status) dataToUpdate.status = status;

    const customerDataToUpdate = {};
    if (customerName) customerDataToUpdate.namaLengkap = customerName;
    if (customerWhatsApp) customerDataToUpdate.nomorWhatsApp = customerWhatsApp;

    await prisma.order.update({
        where: { orderId },
        data: {
            ...dataToUpdate,
            customer: {
                update: customerDataToUpdate
            }
        }
    });

    res.json({ message: "Order updated successfully" });
  } catch (error) {
    console.error("updateOrder error:", error);
    res.status(500).json({ message: "Failed to update order" });
  }
}

// DELETE /api/admin/orders/:orderId
export async function deleteOrder(req, res) {
  try {
    const { orderId } = req.params;

    // Use transaction to delete related records first if necessary, 
    // but Prisma cascading deletion might handle it if configured.
    // Looking at schema, dependencies are:
    // OrderCustomer (relation permissions?)
    // PaymentEvidence (relation?)
    // CouponBook (relation?)

    // Let's check schema again? 
    // CouponBook has `order Order?`. Deleting order might fail if not set to SetNull or Cascade.
    // OrderCustomer has `order Order`.
    
    // Safer to delete/detach in transaction.
    
    await prisma.$transaction(async (tx) => {
        // 1. Unlink CouponBooks
        await tx.couponBook.updateMany({
            where: { orderId },
            data: { orderId: null, assignedAt: null }
        });

        // 2. Delete Payment Evidence
        await tx.paymentEvidence.deleteMany({
            where: { orderId }
        });

        // 3. Delete Customer
        await tx.orderCustomer.deleteMany({
            where: { orderId }
        });

        // 4. Delete Order
        await tx.order.delete({
            where: { orderId }
        });
    });

    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("deleteOrder error:", error);
    res.status(500).json({ message: "Failed to delete order" });
  }
}
