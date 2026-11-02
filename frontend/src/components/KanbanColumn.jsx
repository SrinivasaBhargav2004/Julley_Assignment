import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { calculatePosition } from '../utils/fractionalIndex';

export function KanbanColumn({
  column,
  tasks = [],
  onTaskClick,
  onTaskMove,
  onOpenNewTaskModal,
  activeCollaborators,
  currentUserId,
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Dropping onto a specific task card to place before or after it
  const handleDropOnCard = (targetCard, placement, e) => {
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;

      const { taskId, sourceColumnId, sourcePosition, version } = JSON.parse(dataStr);
      if (taskId === targetCard.id) return; // Ignore dropping onto itself

      const sortedTasks = [...tasks].sort((a, b) => a.position - b.position);
      const otherTasks = sortedTasks.filter((t) => t.id !== taskId);
      const targetIdx = otherTasks.findIndex((t) => t.id === targetCard.id);

      let prevPos = null;
      let nextPos = null;

      if (placement === 'top') {
        nextPos = targetCard.position;
        prevPos = targetIdx > 0 ? otherTasks[targetIdx - 1].position : null;
      } else {
        prevPos = targetCard.position;
        nextPos = targetIdx < otherTasks.length - 1 ? otherTasks[targetIdx + 1].position : null;
      }

      const targetPosition = calculatePosition(prevPos, nextPos);

      onTaskMove({
        taskId,
        sourceColumnId,
        sourcePosition,
        targetColumnId: column.id,
        targetPosition,
        expectedVersion: version,
      });
    } catch (err) {
      console.error('Error handling drop on card:', err);
    }
  };

  // Dropping into the general column container space (append after last card)
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;

      const { taskId, sourceColumnId, sourcePosition, version } = JSON.parse(dataStr);

      const sortedTasks = [...tasks].sort((a, b) => a.position - b.position);
      const otherTasks = sortedTasks.filter((t) => t.id !== taskId);

      let targetPosition;
      if (otherTasks.length === 0) {
        targetPosition = calculatePosition(null, null);
      } else {
        const lastTask = otherTasks[otherTasks.length - 1];
        targetPosition = calculatePosition(lastTask?.position, null);
      }

      onTaskMove({
        taskId,
        sourceColumnId,
        sourcePosition,
        targetColumnId: column.id,
        targetPosition,
        expectedVersion: version,
      });
    } catch (err) {
      console.error('Error handling task drop:', err);
    }
  };

  return (
    <div className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}>
      {/* Column Header */}
      <div className="column-header">
        <div className="column-title-wrap">
          <span
            className="column-indicator"
            style={{ backgroundColor: column.color || 'var(--accent-primary)' }}
          />
          <h3 className="column-title">{column.title}</h3>
        </div>
        <span className="column-count">{tasks.length}</span>
      </div>

      {/* Cards List / Drop Target */}
      <div
        className="column-cards-container"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={onTaskClick}
            activeCollaborators={activeCollaborators}
            currentUserId={currentUserId}
            onDropOnCard={handleDropOnCard}
          />
        ))}

        {tasks.length === 0 && (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            No tasks here. Drop a card or click below.
          </div>
        )}
      </div>

      {/* Add Task Button */}
      <button
        className="column-add-task-btn"
        onClick={() => onOpenNewTaskModal(column.id)}
      >
        <Plus size={14} />
        <span>Add Task</span>
      </button>
    </div>
  );
}
