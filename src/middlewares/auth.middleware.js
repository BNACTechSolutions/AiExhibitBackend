import jwt from 'jsonwebtoken';
import AdminUser from '../models/adminUser.model.js';

export const authMiddleware = (allowedRoles = []) => async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;

        // Fetch user details
        const user = await AdminUser.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        req.user = {
            id: user._id,
            email: user.email, // Attach email
            role: user.user_type, // Include role for additional use
        };
        
        // Verify user role
        if (allowedRoles.length && !allowedRoles.includes(user.user_type)) {
            return res.status(403).json({ message: "Access denied: insufficient permissions" });
        }

        next();
    } catch (error) {
        return res.status(401).json({ message: "Unauthorized: invalid or expired token" });
    }
};

export const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Bearer <token>
    if (!token) {
        return res.status(401).json({ message: 'Access token is missing.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Decode the token
        req.user = decoded; // Attach decoded payload to `req.user`
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};