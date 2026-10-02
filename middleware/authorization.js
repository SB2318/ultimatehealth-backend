// const { throwError } = require("../utils/throwError");
// const { HTTP_STATUS, ERROR_CODES } = require("../constants/errorConstants");

// const authorize =
//   (...allowedRoles) =>
//   (req, res, next) => {
//     if (!req.user) {
//       throwError(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED_ACCESS, "Unauthorized");
//     }

//     if (!allowedRoles.includes(req.user.role)) {
//       throwError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.ACCESS_DENIED, "Forbidden");
//     }

//     next();
//   };

// module.exports = {authorize};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Special check for publisher / contributor role
    if (allowedRoles.includes("contributor") && req.isContributor) {
      return next();
    }
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You do not have required permissions to access this resource",
      });
    }

    next();
  };
};

module.exports = authorize;