/**
 * Middleware to check if the user has superadmin role.
 * Must be used AFTER authenticateToken middleware.
 */
export function requireSuperAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'superadmin') {
        return res.status(403).json({ message: "Access denied: Superadmin role required" });
    }
    next();
}
