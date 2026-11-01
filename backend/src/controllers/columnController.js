const prisma = require('../db/prisma');
const { calculatePosition } = require('../services/fractionalIndex');
const { logActivity } = require('../services/activityService');

async function createColumn(req, res) {
  try {
    const { boardId } = req.params;
    const tenantId = req.tenant.id;
    const { title, color } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Column title is required' });
    }

    // Verify board belongs to this tenant
    const board = await prisma.board.findFirst({
      where: { id: boardId, tenantId },
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found in current tenant' });
    }

    // Find the last column position
    const lastCol = await prisma.column.findFirst({
      where: { boardId, tenantId },
      orderBy: { position: 'desc' },
    });

    const newPosition = calculatePosition(lastCol ? lastCol.position : null, null);

    const column = await prisma.column.create({
      data: {
        boardId,
        tenantId,
        title: title.trim(),
        position: newPosition,
        color: color || '#6366f1',
      },
      include: {
        tasks: true,
      },
    });

    await logActivity({
      tenantId,
      boardId,
      userId: req.user.id,
      action: 'COLUMN_CREATED',
      details: { title: column.title, position: column.position },
      io: req.app.get('io'),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}:board:${boardId}`).emit('column:created', column);
    }

    return res.status(201).json({ column });
  } catch (error) {
    console.error('createColumn error:', error);
    return res.status(500).json({ error: 'Failed to create column' });
  }
}

async function updateColumn(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;
    const { title, color, position } = req.body;

    const existingCol = await prisma.column.findFirst({
      where: { id, tenantId },
    });

    if (!existingCol) {
      return res.status(404).json({ error: 'Column not found in current tenant' });
    }

    const updated = await prisma.column.update({
      where: { id },
      data: {
        title: title ? title.trim() : existingCol.title,
        color: color !== undefined ? color : existingCol.color,
        position: position !== undefined ? parseFloat(position) : existingCol.position,
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}:board:${existingCol.boardId}`).emit('column:updated', updated);
    }

    return res.json({ column: updated });
  } catch (error) {
    console.error('updateColumn error:', error);
    return res.status(500).json({ error: 'Failed to update column' });
  }
}

async function deleteColumn(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;

    if (req.membership.role === 'MEMBER') {
      return res.status(403).json({ error: 'Members cannot delete columns' });
    }

    const existingCol = await prisma.column.findFirst({
      where: { id, tenantId },
    });

    if (!existingCol) {
      return res.status(404).json({ error: 'Column not found in current tenant' });
    }

    await prisma.column.delete({ where: { id } });

    await logActivity({
      tenantId,
      boardId: existingCol.boardId,
      userId: req.user.id,
      action: 'COLUMN_DELETED',
      details: { title: existingCol.title },
      io: req.app.get('io'),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}:board:${existingCol.boardId}`).emit('column:deleted', { id });
    }

    return res.json({ message: 'Column deleted successfully' });
  } catch (error) {
    console.error('deleteColumn error:', error);
    return res.status(500).json({ error: 'Failed to delete column' });
  }
}

module.exports = {
  createColumn,
  updateColumn,
  deleteColumn,
};
