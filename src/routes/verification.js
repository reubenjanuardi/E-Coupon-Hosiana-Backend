import express from 'express';
import { verifyCoupon } from '../controllers/verification.controller.js';

const router = express.Router();

// GET /api/verify/:couponCode
router.get('/:couponCode', verifyCoupon);

export default router;
