const prisma = require('../db/prisma');
const { logActivity } = require('../services/activityService');

async function listBoards(req, res) {
  try {
    const tenantId = req.tenant.id;

    const boards = await prisma.board.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { columns: true, tasks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ boards });
  } catch (error) {
    console.error('listBoards error:', error);
    return res.status(500).json({ error: 'Failed to fetch boards' });
  }
}

async function getBoardById(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;

    // Strict tenant isolation check: board MUST belong to current tenant!
    const board = await prisma.board.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              orderBy: { position: 'asc' },
              include: {
                assignee: {
                  select: { id: true, name: true, email: true, avatarUrl: true },
                },
                creator: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    if (!board) {
      return res.status(404).json({
        error: 'BoardNotFound',
        message: `Board with ID "${id}" was not found in tenant "${req.tenant.name}". Cross-tenant leakage blocked.`,
      });
    }

    return res.json({ board });
  } catch (error) {
    console.error('getBoardById error:', error);
    return res.status(500).json({ error: 'Failed to fetch board' });
  }
}

async function createBoard(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Role check: Only ORG_ADMIN or TENANT_ADMIN can create boards
    if (req.membership.role === 'MEMBER') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Members cannot create boards. Contact a Tenant Admin.',
      });
    }

    // Create board and initialize default columns
    const board = await prisma.board.create({
      data: {
        tenantId,
        title: title.trim(),
        description: description ? description.trim() : null,
        createdBy: req.user.id,
      },
    });

    // Default Kanban columns
    const defaultCols = [
      { title: 'Backlog', position: 1000, color: '#64748b' },
      { title: 'In Progress', position: 2000, color: '#3b82f6' },
      { title: 'Review', position: 3000, color: '#f59e0b' },
      { title: 'Done', position: 4000, color: '#10b981' },
    ];

    for (const col of defaultCols) {
      await prisma.column.create({
        data: {
          boardId: board.id,
          tenantId,
          title: col.title,
          position: col.position,
          color: col.color,
        },
      });
    }

    // Fetch complete board
    const completeBoard = await prisma.board.findUnique({
      where: { id: board.id },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: { tasks: true },
        },
      },
    });

    await logActivity({
      tenantId,
      boardId: board.id,
      userId: req.user.id,
      action: 'BOARD_CREATED',
      details: { title: board.title },
      io: req.app.get('io'),
    });

    // Broadcast board created
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}`).emit('board:created', completeBoard);
    }

    return res.status(201).json({ board: completeBoard });
  } catch (error) {
    console.error('createBoard error:', error);
    return res.status(500).json({ error: 'Failed to create board' });
  }
}

async function updateBoard(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;
    const { title, description } = req.body;

    const existingBoard = await prisma.board.findFirst({
      where: { id, tenantId },
    });

    if (!existingBoard) {
      return res.status(404).json({ error: 'Board not found in current tenant' });
    }

    const updated = await prisma.board.update({
      where: { id },
      data: {
        title: title ? title.trim() : existingBoard.title,
        description: description !== undefined ? description : existingBoard.description,
      },
    });

    await logActivity({
      tenantId,
      boardId: id,
      userId: req.user.id,
      action: 'BOARD_UPDATED',
      details: { title: updated.title },
      io: req.app.get('io'),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}:board:${id}`).emit('board:updated', updated);
    }

    return res.json({ board: updated });
  } catch (error) {
    console.error('updateBoard error:', error);
    return res.status(500).json({ error: 'Failed to update board' });
  }
}

async function deleteBoard(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;

    if (req.membership.role === 'MEMBER') {
      return res.status(403).json({ error: 'Members cannot delete boards' });
    }

    const existingBoard = await prisma.board.findFirst({
      where: { id, tenantId },
    });

    if (!existingBoard) {
      return res.status(404).json({ error: 'Board not found in current tenant' });
    }

    await prisma.board.delete({ where: { id } });

    await logActivity({
      tenantId,
      boardId: id,
      userId: req.user.id,
      action: 'BOARD_DELETED',
      details: { title: existingBoard.title },
      io: req.app.get('io'),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}`).emit('board:deleted', { id, title: existingBoard.title });
    }

    return res.json({ message: 'Board deleted successfully' });
  } catch (error) {
    console.error('deleteBoard error:', error);
    return res.status(500).json({ error: 'Failed to delete board' });
  }
}

module.exports = {
  listBoards,
  getBoardById,
  createBoard,
  updateBoard,
  deleteBoard,
};
