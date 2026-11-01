import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';

export function NewBoardModal({ onClose, onCreateBoard }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Board title is required');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await onCreateBoard(title, description);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create board');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Create New Board</h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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

            <div className="form-group">
              <label className="form-label">Board Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-input"
                placeholder="e.g. Security & Compliance Q1"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-textarea"
                rows={3}
                placeholder="High-level mission, objectives, or track scope..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              <FolderPlus size={16} />
              <span>{isSubmitting ? 'Creating...' : 'Create Board'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
