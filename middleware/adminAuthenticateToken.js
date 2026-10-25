const { verifyAnyToken } = require("../services/security/tokenService");
const { findAdminDocumentById } = require("../services/db/adminService");

const adminAuthenticateToken = async (req, res, next) => {
  const token = req.cookies?.accessToken || req.cookies?.refreshToken || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  try {
    const decoded = await verifyAnyToken(token);

    if (decoded.role !== 'admin' && !decoded.isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    const admin = await findAdminDocumentById(decoded.userId);
    if (!admin || !admin.isVerified || admin.signature_url === "") {
      return res.status(403).json({ error: 'Either Email not verified or Admin not found' });
    }

    if (admin.isBlocked) {
      return res.status(403).json({ error: 'Your admin account has been blocked by Super Admin' });
    }

    req.userId = admin._id;
    req.userRole = admin.role || decoded.role;
    req.isSuperAdmin = Boolean(admin.isSuperAdmin || decoded.isSuperAdmin);
    req.tokenJti = decoded.jti;
    req.tokenExp = decoded.exp;

    next();
  } catch (err) {
    return res.status(401).json({ error: err.message || "Unauthorized admin access" });
  }
};

module.exports = adminAuthenticateToken;
