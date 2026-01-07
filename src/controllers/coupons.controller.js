import { prisma } from "../db/prisma.js";
import { getNowInWIB } from "../utils/timezone.js";

/**
 * GET /api/coupons/books
 * Query Params:
 * - limit: number (default 30)
 * - cursor: string (bookCode for pagination)
 * - search: string (optional search by bookCode)
 * - available: boolean (default true)
 */
export async function getCouponBooks(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const cursor = req.query.cursor;
    const search = req.query.search;
    const available = req.query.available !== "false"; // Default true

    const where = {};

    // Filter by availability
    if (available) {
      where.AND = [
        { orderId: null },
        { assignedAt: null },
        {
          OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lt: getNowInWIB() } }],
        },
      ];
    }

    // Filter by search term
    if (search) {
      where.bookCode = {
        contains: search,
        mode: "insensitive",
      };
    }

    const books = await prisma.couponBook.findMany({
      take: limit + 1, // Fetch one extra to determine next cursor
      cursor: cursor ? { bookCode: cursor } : undefined,
      skip: cursor ? 1 : 0, // Skip the cursor itself
      where,
      orderBy: {
        bookCode: "asc",
      },
      select: {
        bookCode: true,
        orderId: true,
        assignedAt: true,
        lockedBy: true,
        lockExpiresAt: true,
        coupons: {
          select: { couponCode: true },
          orderBy: { couponCode: "asc" },
        },
      },
    });

    let nextCursor = null;
    if (books.length > limit) {
      const nextItem = books.pop(); // Remove the extra item
      nextCursor = nextItem.bookCode;
    }

    // Map to frontend expected format
    const data = books.map((book) => {
      const firstCoupon = book.coupons[0]?.couponCode;
      const lastCoupon = book.coupons[book.coupons.length - 1]?.couponCode;
      const range = firstCoupon && lastCoupon ? ` (${firstCoupon} s/d ${lastCoupon})` : "";

      const isLocked = book.lockedBy && book.lockExpiresAt && book.lockExpiresAt > getNowInWIB();

      return {
        id: book.bookCode,
        name: `${book.bookCode}${range}`,
        available: book.orderId === null && book.assignedAt === null && !isLocked,
        isLocked,
        lockedBy: isLocked ? book.lockedBy : null,
        price: 100000, // Hardcoded as per requirement
      };
    });

    res.json({
      data,
      nextCursor,
    });
  } catch (error) {
    console.error("Error fetching coupon books:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/coupons/books/:bookCode/lock
 * Lock a coupon book for a session
 */
export async function lockCouponBook(req, res) {
  try {
    const { bookCode } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    console.log(`🔒 Lock attempt for ${bookCode} with sessionId: ${sessionId}`);

    // Check if book exists and is available
    const book = await prisma.couponBook.findUnique({
      where: { bookCode },
    });

    if (!book) {
      return res.status(404).json({ error: "Coupon book not found" });
    }

    if (book.orderId !== null || book.assignedAt !== null) {
      return res.status(409).json({ error: "Book is already assigned" });
    }

    // If locked by someone else and not expired, reject
    if (book.lockedBy && book.lockExpiresAt > getNowInWIB() && book.lockedBy !== sessionId) {
      return res.status(409).json({ error: "Book is locked by another user" });
    }

    // Lock the book (15 minute lock)
    const lockExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const lockedBook = await prisma.couponBook.update({
      where: { bookCode },
      data: {
        lockedBy: sessionId,
        lockedAt: getNowInWIB(),
        lockExpiresAt,
      },
      select: {
        bookCode: true,
        lockedBy: true,
        lockExpiresAt: true,
      },
    });

    console.log(`✓ Successfully locked ${bookCode} with sessionId: ${lockedBook.lockedBy}`);
    res.json({ success: true, data: lockedBook });
  } catch (error) {
    console.error("Error locking coupon book:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/coupons/books/:bookCode/unlock
 * Unlock a coupon book
 */
export async function unlockCouponBook(req, res) {
  try {
    const { bookCode } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const book = await prisma.couponBook.findUnique({
      where: { bookCode },
    });

    if (!book) {
      return res.status(404).json({ error: "Coupon book not found" });
    }

    // Only allow unlock if locked by the same session
    console.log(`🔓 Unlock attempt for ${bookCode}:`);
    console.log(`  Sent sessionId: ${sessionId}`);
    console.log(`  Stored lockedBy: ${book.lockedBy}`);
    console.log(`  Match: ${book.lockedBy === sessionId}`);

    if (book.lockedBy !== sessionId) {
      return res.status(403).json({
        error: "Unauthorized to unlock this book",
        details: {
          expected: book.lockedBy,
          received: sessionId,
        },
      });
    }

    const unlockedBook = await prisma.couponBook.update({
      where: { bookCode },
      data: {
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
      select: {
        bookCode: true,
        lockedBy: true,
      },
    });

    res.json({ success: true, data: unlockedBook });
  } catch (error) {
    console.error("Error unlocking coupon book:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/coupons/books/lock-bulk
 * Lock multiple coupon books for a session
 */
export async function lockCouponBooksBulk(req, res) {
  try {
    const { sessionId, bookCodes } = req.body;

    if (!sessionId || !Array.isArray(bookCodes) || bookCodes.length === 0) {
      return res.status(400).json({ error: "sessionId and bookCodes array are required" });
    }

    const lockExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const now = getNowInWIB();

    // Check availability
    const unavailable = await prisma.couponBook.findMany({
      where: {
        bookCode: { in: bookCodes },
        OR: [
          { orderId: { not: null } },
          { assignedAt: { not: null } },
          {
            AND: [{ lockedBy: { not: null } }, { lockExpiresAt: { gt: now } }, { lockedBy: { not: sessionId } }],
          },
        ],
      },
      select: { bookCode: true },
    });

    if (unavailable.length > 0) {
      return res.status(409).json({
        error: "Some books are unavailable",
        unavailableBooks: unavailable.map((b) => b.bookCode),
      });
    }

    // Lock all books
    const result = await prisma.couponBook.updateMany({
      where: {
        bookCode: { in: bookCodes },
      },
      data: {
        lockedBy: sessionId,
        lockedAt: now,
        lockExpiresAt,
      },
    });

    res.json({
      success: true,
      lockedCount: result.count,
      lockExpiresAt,
    });
  } catch (error) {
    console.error("Error bulk locking coupon books:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/coupons/books/unlock-bulk
 * Unlock multiple coupon books
 */
export async function unlockCouponBooksBulk(req, res) {
  try {
    const { sessionId, bookCodes } = req.body;

    if (!sessionId || !Array.isArray(bookCodes) || bookCodes.length === 0) {
      return res.status(400).json({ error: "sessionId and bookCodes array are required" });
    }

    const result = await prisma.couponBook.updateMany({
      where: {
        bookCode: { in: bookCodes },
        lockedBy: sessionId,
      },
      data: {
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
    });

    res.json({
      success: true,
      unlockedCount: result.count,
    });
  } catch (error) {
    console.error("Error bulk unlocking coupon books:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
