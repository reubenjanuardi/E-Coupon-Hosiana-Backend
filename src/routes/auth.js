import express from 'express';
import { login, logout, me } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/logout
router.post('/logout', authenticateToken, logout);

// GET /api/auth/me (Check auth status)
router.get('/me', authenticateToken, me);

export default router;
