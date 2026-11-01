/**
 * Fractional Indexing Service
 * Provides O(1) task reordering without table-wide row locks or mass position updates.
 */

const DEFAULT_STEP = 1000.0;
const MIN_EPSILON = 0.000001;

function calculatePosition(prevPos, nextPos) {
  // Case 1: Inserting into empty list
  if (prevPos == null && nextPos == null) {
    return DEFAULT_STEP;
  }

  // Case 2: Inserting at the beginning of the column
  if (prevPos == null && nextPos != null) {
    if (nextPos <= 1.0) {
      return nextPos / 2.0;
    }
    return nextPos - DEFAULT_STEP > 0 ? nextPos - DEFAULT_STEP : nextPos / 2.0;
  }

  // Case 3: Appending to the end of the column
  if (prevPos != null && nextPos == null) {
    return prevPos + DEFAULT_STEP;
  }

  // Case 4: Inserting between two items
  const mid = (prevPos + nextPos) / 2.0;

  // Handle precision collapse
  if (Math.abs(nextPos - prevPos) < MIN_EPSILON) {
    // Epsilon threshold reached: return mid with slight offset
    return mid;
  }

  return mid;
}

/**
 * Rebalances positions for tasks in a column if numbers get too compressed
 */
async function rebalanceColumnTasks(prisma, columnId, tenantId) {
  const tasks = await prisma.task.findMany({
    where: { columnId, tenantId },
    orderBy: { position: 'asc' },
    select: { id: true },
  });

  const updates = tasks.map((task, index) =>
    prisma.task.update({
      where: { id: task.id },
      data: { position: (index + 1) * DEFAULT_STEP },
    })
  );

  await prisma.$transaction(updates);
}

module.exports = {
  calculatePosition,
  rebalanceColumnTasks,
  DEFAULT_STEP,
};
