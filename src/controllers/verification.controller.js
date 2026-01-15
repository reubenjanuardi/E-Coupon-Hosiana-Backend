// Verification Controller
// Handles coupon code verification for both BOOK (BUKU-0001) and COUPON (KPN-00007) codes
// This is a public, read-only endpoint with NO authentication required

import { prisma } from "../db/prisma.js";

/**
 * Mask sensitive customer information for privacy
 * @param {string} name - Full name
 * @param {string} phone - Phone number
 * @returns {object} Masked owner info
 */
function maskOwnerInfo(name, phone) {
  // Mask name: "Steven Reusser" -> "Stev** Reu***"
  const nameParts = name.split(" ");
  const maskedParts = nameParts.map((part) => {
    if (part.length <= 4) {
      return part.charAt(0) + "*".repeat(part.length - 1);
    }
    return part.substring(0, 4) + "*".repeat(Math.min(part.length - 4, 3));
  });

  // Mask phone: "08123456890" -> "0812****890"
  const phoneStart = phone.substring(0, 4);
  const phoneEnd = phone.substring(phone.length - 3);
  const maskedPhone = phoneStart + "*".repeat(4) + phoneEnd;

  return {
    name: maskedParts.join(" "),
    phone: maskedPhone,
  };
}

/**
 * Verify a coupon code or book code
 * GET /api/verification/:code
 *
 * Accepts:
 * - BUKU-0001 (book code)
 * - KPN-00007 (individual coupon code)
 *
 * Returns verification data with status and masked owner information
 */
export async function verifyCoupon(req, res) {
  try {
    const code = req.params.couponCode?.toUpperCase().trim();

    if (!code) {
      return res.status(400).json({ error: "Code parameter is required" });
    }

    // Determine if it's a BOOK or COUPON code
    const isBookCode = code.startsWith("BUKU-");
    const isCouponCode = code.startsWith("KPN-");

    if (!isBookCode && !isCouponCode) {
      return res.status(400).json({ error: "Invalid code format. Use BUKU-#### or KPN-#####" });
    }

    if (isBookCode) {
      // Verify Book Code (BUKU-0001)
      const book = await prisma.couponBook.findUnique({
        where: { bookCode: code },
        include: {
          order: {
            include: { customer: true },
          },
        },
      });

      if (!book) {
        return res.status(404).json({ error: "Code not found" });
      }

      if (!book.order || !book.order.customer) {
        return res.json({
            type: "BOOK",
            code: book.bookCode,
            status: "available",
            bookCode: book.bookCode,
            owner: null,
          });
      }

      const customer = book.order.customer;
      const maskedOwner = maskOwnerInfo(customer.namaLengkap, customer.nomorWhatsApp);

      // Determine verification status:
      // Valid: Order is verified (fully paid/approved)
      // Pending: Order exists but not verified yet
      const bookStatus = book.order.status === "verified" ? "valid" : "pending";

      return res.json({
        type: "BOOK",
        code: book.bookCode,
        status: bookStatus, // "valid", "pending"
        bookCode: book.bookCode,
        owner: maskedOwner,
      });
    } else {
      // Verify Coupon Code (KPN-00007)
      const coupon = await prisma.coupon.findUnique({
        where: { couponCode: code },
        include: {
          couponBook: {
            include: {
              order: {
                include: { customer: true },
              },
            },
          },
        },
      });

      if (!coupon) {
        return res.status(404).json({ error: "Code not found" });
      }

      if (!coupon.couponBook || !coupon.couponBook.order || !coupon.couponBook.order.customer) {
        return res.json({
            type: "COUPON",
            code: coupon.couponCode,
            status: "available",
            bookCode: coupon.couponBook.bookCode,
            owner: null,
          });
      }

      const customer = coupon.couponBook.order.customer;
      const maskedOwner = maskOwnerInfo(customer.namaLengkap, customer.nomorWhatsApp);

      // Determine status from Order status
      const couponStatus = coupon.couponBook.order.status === "verified" ? "valid" : "pending";

      return res.json({
        type: "COUPON",
        code: coupon.couponCode,
        status: couponStatus, // "valid", "pending"
        bookCode: coupon.couponBook.bookCode,
        owner: maskedOwner,
      });
    }
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json({ error: "Internal server error during verification" });
  }
}
