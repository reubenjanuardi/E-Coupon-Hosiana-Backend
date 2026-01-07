import express from "express";
import { getCouponBooks, lockCouponBook, unlockCouponBook, lockCouponBooksBulk, unlockCouponBooksBulk } from "../controllers/coupons.controller.js";

const router = express.Router();

router.get("/books", getCouponBooks);
router.post("/books/:bookCode/lock", lockCouponBook);
router.post("/books/:bookCode/unlock", unlockCouponBook);
router.post("/books/lock-bulk", lockCouponBooksBulk);
router.post("/books/unlock-bulk", unlockCouponBooksBulk);

export default router;
