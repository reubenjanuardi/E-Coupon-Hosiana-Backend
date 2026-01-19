import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma.js";

// Ensure JWT_SECRET is set
if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
        throw new Error("FATAL: JWT_SECRET is not set in production environment.");
    } else {
        console.warn("⚠️ JWT_SECRET is not set in environment variables. Using a default unsafe secret for development.");
    }
}

const JWT_SECRET = process.env.JWT_SECRET || "unsafe_development_secret";

/**
 * Middleware to authenticate requests using JWT stored in HttpOnly cookie.
 */
export async function authenticateToken(req, res, next) {
    // 1. Get token from cookie
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: "Authentication required" });
    }

    try {
        // 2. Check if token is blacklisted
        const blacklisted = await prisma.tokenBlacklist.findUnique({
            where: { token },
        });

        if (blacklisted) {
            return res.status(403).json({ message: "Token invalidated (logged out)" });
        }

        // 3. Verify token
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ message: "Invalid or expired token" });
            }

            // Attach user to request
            req.user = user;
            next();
        });
    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(500).json({ message: "Internal server error during authentication" });
    }
}
