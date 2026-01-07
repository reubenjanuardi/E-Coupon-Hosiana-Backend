import express from 'express';
import { getAllOrders, getOrderById, verifyOrder } from '../controllers/admin.controller.js';

const router = express.Router();

// GET /api/admin/orders
router.get('/orders', getAllOrders);

// GET /api/admin/orders/:orderId
router.get('/orders/:orderId', getOrderById);

// POST /api/admin/orders/:orderId/verify
router.post('/orders/:orderId/verify', verifyOrder);

export default router;
