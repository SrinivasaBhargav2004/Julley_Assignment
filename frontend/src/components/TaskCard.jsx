import React, { useState } from 'react';
import { Calendar, User, Eye } from 'lucide-react';

export function TaskCard({
  task,
  onClick,
  activeCollaborators = [],
  currentUserId,
  onDropOnCard,
}) {
  const [dropPlacement, setDropPlacement] = useState(null); // 'top' | 'bottom' | null

  const handleDragStart = (e) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        taskId: task.id,
        sourceColumnId: task.columnId,
        sourcePosition: task.position,
        version: task.version,
      })
    );
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
    setDropPlacement(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const isTop = e.clientY - rect.top < rect.height / 2;
    setDropPlacement(isTop ? 'top' : 'bottom');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropPlacement(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const placement = dropPlacement || 'bottom';
    setDropPlacement(null);
    if (onDropOnCard) {
      onDropOnCard(task, placement, e);
    }
  };

  const priorityClasses = {
    URGENT: 'priority-urgent',
    HIGH: 'priority-high',
    MEDIUM: 'priority-medium',
    LOW: 'priority-low',
  };

  // Remote collaborators currently viewing/editing this task (excluding the active user)
  const editingUser = activeCollaborators.find(
    (u) => u.id !== currentUserId && u.activeCardId === task.id
  );

  return (
    <div
      className={`task-card ${dropPlacement ? `drop-target-${dropPlacement}` : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => onClick(task)}
      style={{
        boxShadow:
          dropPlacement === 'top'
            ? '0 -3px 0 0 var(--accent-primary)'
            : dropPlacement === 'bottom'
            ? '0 3px 0 0 var(--accent-primary)'
            : undefined,
      }}
    >
      {/* Remote Live Collaborator Indicator */}
      {editingUser && (
        <div className="task-collaborator-indicator" title={`${editingUser.name} is currently editing this card`}>
          <Eye size={12} />
          <span>{editingUser.name.split(' ')[0]} editing</span>
        </div>
      )}

      {/* Card Header: Priority & Version */}
      <div className="task-card-header">
        <span className={`priority-tag ${priorityClasses[task.priority] || 'priority-medium'}`}>
          {task.priority}
        </span>
        <span className="task-version-tag" title={`Optimistic Concurrency Control Version: ${task.version}`}>
          v{task.version}
        </span>
      </div>

      {/* Task Title */}
      <h4 className="task-title">{task.title}</h4>

      {/* Task Description Snippet */}
      {task.description && (
        <p className="task-description-preview">{task.description}</p>
      )}

      {/* Card Footer: Due date & Assignee */}
      <div className="task-card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {task.dueDate ? (
            <>
              <Calendar size={13} />
              <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </>
          ) : (
            <span style={{ fontSize: '0.7rem' }}>No due date</span>
          )}
        </div>

        {task.assignee ? (
          <img
            src={task.assignee.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop'}
            alt={task.assignee.name}
            title={`Assigned to ${task.assignee.name}`}
            style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            title="Unassigned"
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={12} />
          </div>
        )}
      </div>
    </div>
  );
}
