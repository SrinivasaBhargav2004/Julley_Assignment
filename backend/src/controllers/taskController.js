const prisma = require('../db/prisma');
const { calculatePosition, rebalanceColumnTasks } = require('../services/fractionalIndex');
const { logActivity } = require('../services/activityService');

async function getTaskById(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;

    // Strict tenant isolation: verify task belongs to current tenant
    const task = await prisma.task.findFirst({
      where: { id, tenantId },
      include: {
        column: true,
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        error: 'TaskNotFound',
        message: `Task with ID "${id}" was not found in tenant "${req.tenant.name}". Cross-tenant leakage prevented.`,
      });
    }

    return res.json({ task });
  } catch (error) {
    console.error('getTaskById error:', error);
    return res.status(500).json({ error: 'Failed to fetch task' });
  }
}

async function createTask(req, res) {
  try {
    const { boardId } = req.params;
    const tenantId = req.tenant.id;
    const { columnId, title, description, priority, assigneeId, dueDate } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    if (!columnId) {
      return res.status(400).json({ error: 'columnId is required' });
    }

    // Verify board and column exist in current tenant
    const column = await prisma.column.findFirst({
      where: { id: columnId, boardId, tenantId },
    });

    if (!column) {
      return res.status(404).json({
        error: 'ColumnNotFound',
        message: 'Column does not exist on this board in the active tenant.',
      });
    }

    // Find the last task in this column to compute position
    const lastTask = await prisma.task.findFirst({
      where: { columnId, tenantId },
      orderBy: { position: 'desc' },
    });

    const newPosition = calculatePosition(lastTask ? lastTask.position : null, null);

    const task = await prisma.task.create({
      data: {
        columnId,
        boardId,
        tenantId,
        title: title.trim(),
        description: description ? description.trim() : null,
        priority: priority || 'MEDIUM',
        position: newPosition,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        version: 1, // OCC initial version
        createdBy: req.user.id,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logActivity({
      tenantId,
      boardId,
      taskId: task.id,
      userId: req.user.id,
      action: 'TASK_CREATED',
      details: {
        title: task.title,
        columnId: task.columnId,
        priority: task.priority,
      },
      io: req.app.get('io'),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}:board:${boardId}`).emit('task:created', task);
    }

    return res.status(201).json({ task });
  } catch (error) {
    console.error('createTask error:', error);
    return res.status(500).json({ error: 'Failed to create task' });
  }
}

/**
 * Update Task with Optimistic Concurrency Control (OCC)
 */
async function updateTask(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;
    const {
      title,
      description,
      priority,
      assigneeId,
      dueDate,
      expectedVersion,
      force,
    } = req.body;

    // Strict tenant check
    const existingTask = await prisma.task.findFirst({
      where: { id, tenantId },
      include: {
        column: true,
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!existingTask) {
      return res.status(404).json({
        error: 'TaskNotFound',
        message: `Task with ID "${id}" was not found in tenant "${req.tenant.name}".`,
      });
    }

    // Optimistic Concurrency Control Check
    if (
      expectedVersion !== undefined &&
      existingTask.version !== Number(expectedVersion) &&
      !force
    ) {
      return res.status(409).json({
        error: 'ConflictDetected',
        message: `Concurrent Edit Conflict: This task was modified by another collaborator (Current server version: ${existingTask.version}, your version: ${expectedVersion}). Please review changes or choose resolution.`,
        serverVersion: existingTask.version,
        serverTask: existingTask,
        clientVersion: Number(expectedVersion),
      });
    }

    // Determine field diffs for activity log
    const diffs = {};
    if (title && title !== existingTask.title) diffs.title = { from: existingTask.title, to: title };
    if (description !== undefined && description !== existingTask.description) diffs.description = { updated: true };
    if (priority && priority !== existingTask.priority) diffs.priority = { from: existingTask.priority, to: priority };
    if (assigneeId !== undefined && assigneeId !== existingTask.assigneeId) diffs.assigneeId = { from: existingTask.assigneeId, to: assigneeId };
    if (dueDate !== undefined) diffs.dueDate = { to: dueDate };

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title ? title.trim() : existingTask.title,
        description: description !== undefined ? (description ? description.trim() : null) : existingTask.description,
        priority: priority || existingTask.priority,
        assigneeId: assigneeId !== undefined ? assigneeId : existingTask.assigneeId,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existingTask.dueDate,
        version: existingTask.version + 1, // Increment OCC version atomically
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logActivity({
      tenantId,
      boardId: existingTask.boardId,
      taskId: updatedTask.id,
      userId: req.user.id,
      action: 'TASK_UPDATED',
      details: diffs,
      io: req.app.get('io'),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}:board:${existingTask.boardId}`).emit('task:updated', updatedTask);
    }

    return res.json({ task: updatedTask });
  } catch (error) {
    console.error('updateTask error:', error);
    return res.status(500).json({ error: 'Failed to update task' });
  }
}

/**
 * Move Task (Drag & Drop) using Fractional Indexing & OCC
 */
async function moveTask(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;
    const {
      targetColumnId,
      prevTaskId,
      nextTaskId,
      targetPosition,
      expectedVersion,
    } = req.body;

    const existingTask = await prisma.task.findFirst({
      where: { id, tenantId },
      include: { column: true },
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found in current tenant' });
    }

    // Optional OCC check for move operations
    if (
      expectedVersion !== undefined &&
      existingTask.version !== Number(expectedVersion)
    ) {
      return res.status(409).json({
        error: 'ConflictDetected',
        message: 'Task position or state was altered concurrently.',
        serverVersion: existingTask.version,
        serverTask: existingTask,
        clientVersion: Number(expectedVersion),
      });
    }

    let calculatedPosition = targetPosition;

    // If explicit relative IDs are provided, compute fractional position
    if (calculatedPosition === undefined) {
      let prevPos = null;
      let nextPos = null;

      if (prevTaskId) {
        const prevTask = await prisma.task.findFirst({
          where: { id: prevTaskId, tenantId },
          select: { position: true },
        });
        if (prevTask) prevPos = prevTask.position;
      }

      if (nextTaskId) {
        const nextTask = await prisma.task.findFirst({
          where: { id: nextTaskId, tenantId },
          select: { position: true },
        });
        if (nextTask) nextPos = nextTask.position;
      }

      calculatedPosition = calculatePosition(prevPos, nextPos);
    }

    const newColId = targetColumnId || existingTask.columnId;

    // Verify target column exists in this tenant & board
    if (targetColumnId && targetColumnId !== existingTask.columnId) {
      const targetColumn = await prisma.column.findFirst({
        where: { id: targetColumnId, boardId: existingTask.boardId, tenantId },
      });
      if (!targetColumn) {
        return res.status(400).json({ error: 'Target column does not exist on this board' });
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        columnId: newColId,
        position: calculatedPosition,
        version: existingTask.version + 1,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logActivity({
      tenantId,
      boardId: existingTask.boardId,
      taskId: updatedTask.id,
      userId: req.user.id,
      action: 'TASK_MOVED',
      details: {
        fromColumnId: existingTask.columnId,
        toColumnId: newColId,
        position: calculatedPosition,
      },
      io: req.app.get('io'),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}:board:${existingTask.boardId}`).emit('task:moved', updatedTask);
    }

    return res.json({ task: updatedTask });
  } catch (error) {
    console.error('moveTask error:', error);
    return res.status(500).json({ error: 'Failed to move task' });
  }
}

async function deleteTask(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;

    const existingTask = await prisma.task.findFirst({
      where: { id, tenantId },
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found in current tenant' });
    }

    await prisma.task.delete({ where: { id } });

    await logActivity({
      tenantId,
      boardId: existingTask.boardId,
      taskId: id,
      userId: req.user.id,
      action: 'TASK_DELETED',
      details: { title: existingTask.title },
      io: req.app.get('io'),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}:board:${existingTask.boardId}`).emit('task:deleted', {
        id,
        columnId: existingTask.columnId,
        boardId: existingTask.boardId,
      });
    }

    return res.json({ message: 'Task deleted successfully', id });
  } catch (error) {
    console.error('deleteTask error:', error);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
}

module.exports = {
  getTaskById,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
};
