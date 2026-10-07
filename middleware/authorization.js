const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Extract userId & userRole flexibly from either req.userId/req.userRole OR req.user object
    const userId = req.userId || req.user?.userId || req.user?._id;
    const userRole = req.userRole || req.user?.role;
    const isContributor = req.isContributor || req.user?.isContributor || false;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Special check for publisher / contributor role
    if (allowedRoles.includes("contributor") && isContributor) {
      return next();
    }

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You do not have required permissions to access this resource",
      });
    }

    next();
  };
};

module.exports = { authorize };