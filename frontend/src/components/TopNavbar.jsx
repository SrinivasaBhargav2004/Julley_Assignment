import React from 'react';
import {
  Layers,
  ChevronRight,
  Wifi,
  WifiOff,
  History,
  Building2,
  GitBranch,
  Shield,
} from 'lucide-react';

export function TopNavbar({
  organizations,
  selectedOrg,
  onSelectOrg,
  tenants,
  selectedTenant,
  onSelectTenant,
  currentUser,
  currentRole,
  isConnected,
  activeUsers,
  onOpenActivityDrawer,
}) {
  return (
    <header className="top-navbar">
      {/* Brand & Hierarchy Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div className="brand-section">
          <div className="brand-logo">
            <Layers size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="brand-title">NexusBoard</span>
              <span className="brand-version">v2.4-OCC</span>
            </div>
          </div>
        </div>

        {/* Multi-Org & Tenant Switchers */}
        <div className="hierarchy-controls">
          {/* Organization Switcher */}
          <div className="selector-group">
            <Building2 size={15} style={{ color: 'var(--accent-primary)' }} />
            <select
              className="custom-select"
              value={selectedOrg?.id || ''}
              onChange={(e) => {
                const org = organizations.find((o) => o.id === e.target.value);
                if (org) onSelectOrg(org);
              }}
              aria-label="Select Organization"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <ChevronRight size={14} className="hierarchy-arrow" />

          {/* Tenant (Branch) Switcher */}
          <div className="selector-group">
            <GitBranch size={15} style={{ color: 'var(--status-purple)' }} />
            <select
              className="custom-select"
              value={selectedTenant?.id || ''}
              onChange={(e) => {
                const tenant = tenants.find((t) => t.id === e.target.value);
                if (tenant) onSelectTenant(tenant);
              }}
              aria-label="Select Tenant Branch"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Real-time Status, Presence & User Profile */}
      <div className="header-actions">
        {/* Live Socket Status */}
        <div
          className={`live-indicator ${isConnected ? 'connected' : 'disconnected'}`}
          title={isConnected ? 'Connected to tenant WebSocket room' : 'Disconnected from server'}
        >
          <span className="live-dot" />
          <span>{isConnected ? 'LIVE SYNC' : 'OFFLINE'}</span>
        </div>

        {/* Active Collaborators Presence Stack */}
        <div className="presence-stack" title={`${activeUsers.length} collaborator(s) in this room`}>
          {activeUsers.slice(0, 4).map((u) => (
            <div key={u.id} className="presence-avatar" title={`${u.name} (${u.role || 'Member'})`}>
              <img
                src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop'}
                alt={u.name}
              />
            </div>
          ))}
          {activeUsers.length > 4 && (
            <div className="presence-count-badge">+{activeUsers.length - 4}</div>
          )}
        </div>

        {/* Activity Logs Drawer Button */}
        <button
          className="btn-secondary"
          onClick={onOpenActivityDrawer}
          title="View Tenant Activity & Audit Trail"
        >
          <History size={16} />
          <span>Activity Log</span>
        </button>

        {/* Current User Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            paddingLeft: '12px',
            borderLeft: '1px solid var(--border-subtle)',
          }}
        >
          <img
            src={
              currentUser?.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop'
            }
            alt={currentUser?.name}
            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{currentUser?.name}</span>
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--accent-primary)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Shield size={11} />
              {currentRole || 'MEMBER'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
