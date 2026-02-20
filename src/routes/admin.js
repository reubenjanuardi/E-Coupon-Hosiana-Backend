import express from 'express';
import {
    getAllOrders,
    getOrderById,
    verifyOrder,
    rejectOrder,
    getDashboardStats,
    mergeOrderPdfs,
    markOrderSent, 
    getWhatsAppMessage,
    createOrder,
    updateOrder,
    deleteOrder,
    toggleChurchOrder
} from '../controllers/admin.controller.js';
import { requireSuperAdmin } from '../middlewares/role.middleware.js';

const router = express.Router();

// GET /api/admin/stats
router.get('/stats', getDashboardStats);

// GET /api/admin/orders
router.get('/orders', getAllOrders);

// POST /api/admin/orders (Superadmin only)
router.post('/orders', requireSuperAdmin, createOrder);

// GET /api/admin/orders/:orderId
router.get('/orders/:orderId', getOrderById);

// PUT /api/admin/orders/:orderId (Superadmin only)
router.put('/orders/:orderId', requireSuperAdmin, updateOrder);

// DELETE /api/admin/orders/:orderId (Superadmin only)
router.delete('/orders/:orderId', requireSuperAdmin, deleteOrder);

// PATCH /api/admin/orders/:orderId/toggle-church (Basic Admin allowed)
router.patch('/orders/:orderId/toggle-church', toggleChurchOrder);

// POST /api/admin/orders/:orderId/verify
router.post('/orders/:orderId/verify', verifyOrder);

// POST /api/admin/orders/:orderId/reject
router.post('/orders/:orderId/reject', rejectOrder);

// POST /api/admin/orders/:orderId/merge-pdf
router.post('/orders/:orderId/merge-pdf', mergeOrderPdfs);

// POST /api/admin/orders/:orderId/mark-sent
router.post('/orders/:orderId/mark-sent', markOrderSent);

// GET /api/admin/orders/:orderId/whatsapp-message
router.get('/orders/:orderId/whatsapp-message', getWhatsAppMessage);

export default router;
