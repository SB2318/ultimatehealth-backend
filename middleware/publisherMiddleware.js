const jwt = require('jsonwebtoken');
const authenticateToken = require('./authentcatetoken');
const User = require('../models/UserModel');

const publisherMiddleware = async (req, res, next) => {
    const accessToken = req.cookies?.accessToken || req.headers['authorization']?.split(' ')[1];
    
    if (!accessToken) {
        return res.status(401).json({ error: 'No access token provided' });
    }

    try {
        // First try to verify as a publisher/contributor token
        const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "sb2318@ultimatehealth_refresh";
        const decoded = jwt.verify(accessToken, secret);
        
        if (decoded && decoded.isContributor) {
            const user = await User.findById(decoded.userId);
            if (!user || !user.isVerified) {
                return res.status(403).json({ error: 'Email not verified or user not found' });
            }
            req.userId = user._id;
            return next();
        }
    } catch (err) {
        
    }
    
    // Fallback to existing standard authentication
    return authenticateToken(req, res, next);
};

module.exports = publisherMiddleware;
