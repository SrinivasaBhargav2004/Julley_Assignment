const prisma = require('../db/prisma');

async function listActivities(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { boardId, limit = 50 } = req.query;

    const where = { tenantId };
    if (boardId) {
      where.boardId = boardId;
    }

    const activities = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return res.json({ activities });
  } catch (error) {
    console.error('listActivities error:', error);
    return res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
}

module.exports = {
  listActivities,
};
