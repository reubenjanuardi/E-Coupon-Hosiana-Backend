import express from 'express';
import {
    getAllOrders,
    getOrderById,
    verifyOrder,
    rejectOrder,
    getDashboardStats
} from '../controllers/admin.controller.js';

const router = express.Router();

// GET /api/admin/stats
router.get('/stats', getDashboardStats);

// GET /api/admin/orders
router.get('/orders', getAllOrders);

// GET /api/admin/orders/:orderId
router.get('/orders/:orderId', getOrderById);

// POST /api/admin/orders/:orderId/verify
router.post('/orders/:orderId/verify', verifyOrder);

// POST /api/admin/orders/:orderId/reject
router.post('/orders/:orderId/reject', rejectOrder);

export default router;
