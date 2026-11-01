function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.membership || !req.membership.role) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No tenant membership role determined for this request.',
      });
    }

    const userRole = req.membership.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'InsufficientPermissions',
        message: `Action requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: ${userRole}.`,
      });
    }

    next();
  };
}

module.exports = {
  requireRole,
};
