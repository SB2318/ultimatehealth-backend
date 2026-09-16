const jwt = require('jsonwebtoken');
require('dotenv').config();
const User = require("../models/UserModel");
const Admin = require("../models/admin/adminModel");

// Cache utility functions (add these)
const cache = {
    store: new Map(),
    
    async get(key) {
        const item = this.store.get(key);
        if (!item) return null;
        
        // Check if expired
        if (item.expiry && item.expiry < Date.now()) {
            this.store.delete(key);
            return null;
        }
        return item.data;
    },
    
    async set(key, data, ttlSeconds = 3600) {
        this.store.set(key, {
            data: data,
            expiry: Date.now() + (ttlSeconds * 1000)
        });
    },
    
    async del(key) {
        this.store.delete(key);
    },
    
    async clearPattern(pattern) {
        for (let key of this.store.keys()) {
            if (key.includes(pattern)) {
                this.store.delete(key);
            }
        }
    }
};

const verifyToken = async (req, res, next) => {
    let token;

    // Extract token from cookie or header
    if (req.cookies && req.cookies['token']) {
        token = req.cookies['token'];
    } else {
        token = req.headers.authorization?.split(' ')[1];
    }

    // Check for token missing
    if (!token) {
        // Clear any cached error for this route
        await cache.del(req.originalUrl);
        
        return res.status(401).json({ 
            success: false,
            error: 'Authorization token missing' 
        });
    }

    // Generate cache key for this request
    const cacheKey = `auth:${token}`;
    
    // Check cache first (only for successful auth)
    const cachedUser = await cache.get(cacheKey);
    if (cachedUser) {
        req.userId = cachedUser.userId;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [user, admin] = await Promise.all([
            User.findById(decoded.userId),
            Admin.findById(decoded.userId)
        ]);

        // Check admin first
        if (admin && admin.isVerified) {
            // Success - cache this valid session
            await cache.set(cacheKey, { userId: admin._id, role: 'admin' }, 3600);
            req.userId = admin._id;
            return next();
        }
        
        // Check user
        if (user && user.isVerified) {
            // Success - cache this valid session
            await cache.set(cacheKey, { userId: user._id, role: 'user' }, 3600);
            req.userId = user._id;
            return next();
        }
        
        // User not verified - don't cache this error
        await cache.del(cacheKey);
        return res.status(403).json({ 
            success: false,
            error: 'Email not verified' 
        });
        
    } catch (err) {
        console.error('Error verifying token:', err);
        
        // Clear any stale cache for this token
        await cache.del(cacheKey);
        
        // Different error messages based on error type
        if (err.name === 'JsonWebTokenError') {
            return res.status(403).json({ 
                success: false,
                error: 'Invalid token' 
            });
        }
        
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                error: 'Token expired, please login again' 
            });
        }
        
        return res.status(403).json({ 
            success: false,
            error: 'Invalid or expired token' 
        });
    }
};

const verifyUser = async (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || !user.isVerified) {
            throw new Error("Token expired, please login again");
        }
        return decoded.email;
    } catch (err) {
        throw err;
    }
};

module.exports = { verifyToken, verifyUser };
