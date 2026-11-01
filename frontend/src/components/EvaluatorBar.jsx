import React from 'react';
import { ShieldCheck, UserCheck, RefreshCw } from 'lucide-react';

export function EvaluatorBar({ users, currentUser, onSwitchUser }) {
  return (
    <div className="evaluator-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span className="evaluator-tag">
          <ShieldCheck size={14} />
          MULTI-TENANT RBAC EVALUATOR
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          Switch users to test live collaboration across roles & tenants:
        </span>
      </div>

      <div className="user-quick-switcher">
        {users.map((u) => {
          const isActive = currentUser?.id === u.id;
          const membership = u.memberships?.[0];
          const roleDisplay = membership?.role?.replace('_', ' ') || 'MEMBER';

          return (
            <button
              key={u.id}
              className={`user-quick-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSwitchUser(u.id)}
              title={`${u.name} (${u.email}) - ${roleDisplay}`}
            >
              <img
                src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop'}
                alt={u.name}
                style={{ width: '16px', height: '16px', borderRadius: '50%' }}
              />
              <span>{u.name.split(' ')[0]}</span>
              <span
                style={{
                  fontSize: '0.65rem',
                  opacity: 0.8,
                  padding: '1px 4px',
                  borderRadius: '3px',
                  background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                }}
              >
                {roleDisplay}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
