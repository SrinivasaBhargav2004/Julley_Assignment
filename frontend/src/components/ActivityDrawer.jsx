import React from 'react';
import { X, History, Clock } from 'lucide-react';

export function ActivityDrawer({ isOpen, onClose, activities = [], tenantName }) {
  if (!isOpen) return null;

  const formatAction = (log) => {
    try {
      const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details || {};

      switch (log.action) {
        case 'TASK_CREATED':
          return (
            <span>
              created task <strong>"{details.title || 'Untitled'}"</strong>
            </span>
          );
        case 'TASK_MOVED':
          return (
            <span>
              moved task {details.taskTitle ? <strong>"{details.taskTitle}"</strong> : ''} to a new position/column
            </span>
          );
        case 'TASK_UPDATED':
          const keys = Object.keys(details).filter((k) => k !== 'taskTitle');
          return (
            <span>
              updated task {details.taskTitle ? <strong>"{details.taskTitle}"</strong> : ''}{' '}
              {keys.length > 0 ? `(${keys.join(', ')})` : ''}
            </span>
          );
        case 'TASK_DELETED':
          return (
            <span style={{ color: 'var(--status-rose)' }}>
              deleted task <strong>"{details.title || ''}"</strong>
            </span>
          );
        case 'BOARD_CREATED':
          return (
            <span>
              created new board <strong>"{details.title}"</strong>
            </span>
          );
        case 'BOARD_UPDATED':
          return (
            <span>
              updated board <strong>"{details.title}"</strong>
            </span>
          );
        case 'BOARD_DELETED':
          return (
            <span style={{ color: 'var(--status-rose)' }}>
              deleted board <strong>"{details.title || ''}"</strong>
            </span>
          );
        case 'COLUMN_CREATED':
          return (
            <span>
              created column <strong>"{details.title}"</strong>
            </span>
          );
        case 'COLUMN_DELETED':
          return (
            <span style={{ color: 'var(--status-rose)' }}>
              deleted column <strong>"{details.title || ''}"</strong>
            </span>
          );
        default:
          return <span>performed action: {log.action}</span>;
      }
    } catch (e) {
      return <span>performed action: {log.action}</span>;
    }
  };

  const formatTime = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-container">
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} style={{ color: 'var(--accent-primary)' }} />
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Tenant Audit Log</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Scoped to branch: <strong>{tenantName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="drawer-content">
          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              No recorded activity yet in this branch.
            </div>
          ) : (
            activities.map((log) => (
              <div key={log.id} className="log-item">
                <img
                  src={
                    log.user?.avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop'
                  }
                  alt={log.user?.name}
                  className="log-avatar"
                />
                <div className="log-body">
                  <span className="log-user">{log.user?.name || 'Collaborator'} </span>
                  <span className="log-action">{formatAction(log)}</span>
                  <div className="log-time">
                    <Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />
                    {formatTime(log.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
