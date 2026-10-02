const { verifyAccessToken } = require("../services/security/tokenService");
const Admin = require("../models/admin/adminModel");

const adminAuthenticateToken = async (req, res, next) => {
  const token = req.cookies?.accessToken || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  try {
    const decoded = await verifyAccessToken(token);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    const admin = await Admin.findById(decoded.userId);
    if (!admin || !admin.isVerified || admin.signature_url === "") {
      return res.status(403).json({ error: 'Either Email not verified or Admin not found' });
    }

    req.userId = admin._id;
    req.userRole = decoded.role;
    req.tokenJti = decoded.jti;
    req.tokenExp = decoded.exp;

    next();
  } catch (err) {
    return res.status(401).json({ error: err.message || "Unauthorized admin access" });
  }
};

module.exports = adminAuthenticateToken;
