import express from 'express';
import { createOrder, getOrder, cancelOrder } from '../controllers/orders.controller.js';
import { validateCreateOrder } from '../utils/validators.js';

const router = express.Router();

// POST /api/orders
router.post('/', validateCreateOrder, createOrder);

// GET /api/orders/:orderId
router.get('/:orderId', getOrder);

// POST /api/orders/:orderId/cancel
router.post('/:orderId/cancel', cancelOrder);

export default router;
