import express from "express";
import { getQris, uploadEvidenceMiddleware, uploadPaymentEvidence } from "../controllers/payments.controller.js";

const router = express.Router();

// POST /api/payments/evidence
router.post("/evidence", uploadEvidenceMiddleware, uploadPaymentEvidence);
router.get("/qris/:orderId", getQris);

export default router;
