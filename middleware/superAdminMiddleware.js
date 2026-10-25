const { throwError } = require("../utils/throwError");
const { HTTP_STATUS, ERROR_CODES } = require("../constants/errorConstants");
const { findAdminDocumentById } = require("../services/db/adminService");

/**
 * Ensures the authenticated admin has super admin privileges (isSuperAdmin: true).
 * Must be preceded by adminAuthenticateToken.
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    const adminId = req.userId;

    if (!adminId) {
      throwError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED,
        "Admin authentication required"
      );
    }

    const admin = await findAdminDocumentById(adminId);
    if (!admin || !admin.isSuperAdmin) {
      throwError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        "Access denied: Super Admin privilege required"
      );
    }

    req.superAdmin = admin;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = requireSuperAdmin;
