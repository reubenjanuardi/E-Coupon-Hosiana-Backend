import { prisma } from "../db/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "unsafe_development_secret";
const TOKEN_EXPIRY = "24h";

export async function login(req, res) {
    try {
        const { username, password } = req.body;

        // 1. Find user
        const user = await prisma.admin.findUnique({
            where: { username },
        });

        if (!user) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // 2. Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // 3. Generate Token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        // 4. Set HttpOnly Cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // True in production
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });

        res.json({ message: "Login successful", user: { username: user.username } });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Login failed" });
    }
}

export async function logout(req, res) {
    try {
        const token = req.cookies.token;

        if (token) {
            // 1. Decode token to get expiry
            const decoded = jwt.decode(token);

            // 2. Blacklist token if valid structure
            if (decoded && decoded.exp) {
                await prisma.tokenBlacklist.create({
                    data: {
                        token,
                        expiresAt: new Date(decoded.exp * 1000),
                    },
                });
            }
        }

        // 3. Clear cookie
        res.clearCookie("token");

        res.json({ message: "Logout successful" });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ message: "Logout failed" });
    }
}

export async function me(req, res) {
    // If middleware passed, user is authenticated
    res.json({ user: req.user });
}
