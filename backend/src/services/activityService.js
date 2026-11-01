const prisma = require('../db/prisma');

/**
 * Activity Log Service
 * Records audit logs for all tenant mutations and triggers real-time stream
 */
async function logActivity({ tenantId, boardId, taskId, userId, action, details, io }) {
  try {
    const log = await prisma.activityLog.create({
      data: {
        tenantId,
        boardId: boardId || null,
        taskId: taskId || null,
        userId,
        action,
        details: typeof details === 'object' ? JSON.stringify(details) : details || '{}',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Broadcast activity log event to tenant room if socket io is provided
    if (io) {
      io.to(`tenant:${tenantId}`).emit('activity:logged', log);
      if (boardId) {
        io.to(`tenant:${tenantId}:board:${boardId}`).emit('activity:logged', log);
      }
    }

    return log;
  } catch (error) {
    console.error('Failed to write activity log:', error);
    return null;
  }
}

module.exports = {
  logActivity,
};
