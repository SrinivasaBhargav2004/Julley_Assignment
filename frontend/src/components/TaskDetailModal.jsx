import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  User,
  AlertTriangle,
  Trash2,
  Save,
  CheckCircle,
  Clock,
  RotateCcw,
} from 'lucide-react';

function formatDueDate(val) {
  if (!val) return '';
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

export function TaskDetailModal({
  task,
  columns,
  users = [],
  onClose,
  onUpdateTask,
  onDeleteTask,
  focusCard,
}) {
  const [formData, setFormData] = useState({
    title: task.title || '',
    description: task.description || '',
    priority: task.priority || 'MEDIUM',
    columnId: task.columnId || '',
    assigneeId: task.assigneeId || '',
    dueDate: formatDueDate(task.dueDate),
  });

  const [conflictData, setConflictData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Notify socket room that current user is focusing this card
  useEffect(() => {
    if (focusCard && task?.id) {
      focusCard(task.id);
    }
    return () => {
      if (focusCard) {
        focusCard(null);
      }
    };
  }, [task?.id]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSave = async (forceOverwrite = false) => {
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await onUpdateTask({
        taskId: task.id,
        updatedFields: {
          ...formData,
          expectedVersion: forceOverwrite ? conflictData?.serverVersion : task.version,
          force: forceOverwrite,
        },
        previousTask: task,
      });

      onClose();
    } catch (err) {
      if (err.status === 409 && err.data) {
        // Optimistic Concurrency Control Conflict Triggered!
        setConflictData({
          serverTask: err.data.serverTask,
          serverVersion: err.data.serverVersion,
          clientVersion: err.data.clientVersion,
        });
      } else {
        setErrorMsg(err.message || 'Failed to update task');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscardAndAcceptServer = () => {
    if (!conflictData?.serverTask) return;
    const server = conflictData.serverTask;
    setFormData({
      title: server.title || '',
      description: server.description || '',
      priority: server.priority || 'MEDIUM',
      columnId: server.columnId || '',
      assigneeId: server.assigneeId || '',
      dueDate: formatDueDate(server.dueDate),
    });
    setConflictData(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Task Details</h3>
            <span
              className="task-version-tag"
              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
            >
              OCC Version: v{task.version}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Conflict Resolution Banner */}
          {conflictData && (
            <div className="conflict-banner">
              <div className="conflict-banner-title">
                <AlertTriangle size={18} />
                <span>Concurrent Edit Conflict Detected!</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#fde68a' }}>
                Another collaborator updated this task while you were editing (Server is at{' '}
                <strong>v{conflictData.serverVersion}</strong>, your local draft was based on{' '}
                <strong>v{conflictData.clientVersion}</strong>).
              </p>

              <div className="conflict-diff-grid">
                <div>
                  <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: '4px' }}>Your Local Edits:</div>
                  <div><strong>Title:</strong> {formData.title}</div>
                  <div><strong>Priority:</strong> {formData.priority}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#86efac', marginBottom: '4px' }}>Server (Latest) State:</div>
                  <div><strong>Title:</strong> {conflictData.serverTask.title}</div>
                  <div><strong>Priority:</strong> {conflictData.serverTask.priority}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  className="btn-primary"
                  style={{
                    fontSize: '0.75rem',
                    background: '#d97706',
                    padding: '5px 10px',
                  }}
                  onClick={() => handleSave(true)}
                >
                  <Save size={12} />
                  Overwrite with My Changes (Force)
                </button>
                <button
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                  onClick={handleDiscardAndAcceptServer}
                >
                  <RotateCcw size={12} />
                  Discard & Accept Latest
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                background: 'var(--status-rose-bg)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                color: 'var(--status-rose)',
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Title */}
          <div className="form-group">
            <label className="form-label">Task Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="form-input"
              placeholder="Enter title..."
              required
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-textarea"
              rows={4}
              placeholder="Detailed description, notes, or acceptance criteria..."
            />
          </div>

          {/* Priority & Status Column */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="form-select"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Column / Status</label>
              <select
                name="columnId"
                value={formData.columnId}
                onChange={handleChange}
                className="form-select"
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignee & Due Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Assignee</label>
              <select
                name="assigneeId"
                value={formData.assigneeId}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          {/* Metadata Footprint */}
          <div
            style={{
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>Created by: {task.creator?.name || 'System'}</span>
            <span>Last modified: {task.updatedAt ? new Date(task.updatedAt).toLocaleString() : 'Recently'}</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onDeleteTask(task.id)}
            style={{ color: 'var(--status-rose)', marginRight: 'auto' }}
          >
            <Trash2 size={15} />
            <span>Delete</span>
          </button>

          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
          >
            <CheckCircle size={15} />
            <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
