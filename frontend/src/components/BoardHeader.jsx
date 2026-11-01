import React from 'react';
import {
  Kanban,
  Plus,
  Undo2,
  Redo2,
  Search,
  SlidersHorizontal,
  FolderPlus,
} from 'lucide-react';

export function BoardHeader({
  boards,
  activeBoard,
  onSelectBoard,
  onOpenNewBoardModal,
  onOpenNewTaskModal,
  canCreateBoard,
  undoRedo,
  searchQuery,
  onSearchChange,
  priorityFilter,
  onPriorityFilterChange,
}) {
  return (
    <div className="board-header-bar">
      <div className="board-title-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Kanban size={22} style={{ color: 'var(--accent-primary)' }} />
          <select
            className="board-select-pill"
            value={activeBoard?.id || ''}
            onChange={(e) => {
              const b = boards.find((item) => item.id === e.target.value);
              if (b) onSelectBoard(b);
            }}
            aria-label="Select Kanban Board"
          >
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </div>

        {canCreateBoard && (
          <button
            className="btn-secondary"
            onClick={onOpenNewBoardModal}
            title="Create New Board in this Tenant"
            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
          >
            <FolderPlus size={14} />
            <span>New Board</span>
          </button>
        )}
      </div>

      <div className="board-toolbar-actions">
        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '4px 10px',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.825rem',
              outline: 'none',
              width: '140px',
            }}
          />
        </div>

        {/* Priority Filter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '4px 8px',
          }}
        >
          <SlidersHorizontal size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            value={priorityFilter}
            onChange={(e) => onPriorityFilterChange(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
            }}
            aria-label="Filter by priority"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent Only</option>
            <option value="HIGH">High Only</option>
            <option value="MEDIUM">Medium Only</option>
            <option value="LOW">Low Only</option>
          </select>
        </div>

        {/* Undo / Redo Controls */}
        <div className="undo-redo-group">
          <button
            className="undo-btn"
            onClick={undoRedo.undo}
            disabled={!undoRedo.canUndo}
            title={undoRedo.undoActionName ? `Undo: ${undoRedo.undoActionName} (Ctrl+Z)` : 'Undo (Ctrl+Z)'}
          >
            <Undo2 size={14} />
            <span>Undo</span>
          </button>
          <button
            className="undo-btn"
            onClick={undoRedo.redo}
            disabled={!undoRedo.canRedo}
            title={undoRedo.redoActionName ? `Redo: ${undoRedo.redoActionName} (Ctrl+Y)` : 'Redo (Ctrl+Y)'}
          >
            <Redo2 size={14} />
            <span>Redo</span>
          </button>
        </div>

        {/* Create Task Button */}
        <button className="btn-primary" onClick={onOpenNewTaskModal}>
          <Plus size={16} />
          <span>New Task</span>
        </button>
      </div>
    </div>
  );
}
