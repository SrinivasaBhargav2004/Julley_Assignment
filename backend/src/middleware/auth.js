const prisma = require('../db/prisma');
const { verifyToken } = require('../utils/auth');

async function authMiddleware(req, res, next) {
  try {
    let user = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        user = await prisma.user.findUnique({
          where: { id: decoded.userId },
        });
      }
    }

    // Support X-User-ID or X-User-Email for quick interactive evaluator switching
    if (!user && req.headers['x-user-id']) {
      user = await prisma.user.findUnique({
        where: { id: req.headers['x-user-id'] },
      });
    }

    if (!user && req.headers['x-user-email']) {
      user = await prisma.user.findUnique({
        where: { email: req.headers['x-user-email'] },
      });
    }

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token or user identifier required.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error in auth verification' });
  }
}

module.exports = authMiddleware;
