import React from 'react';
import { 
  LayoutDashboard, 
  FolderLock, 
  KeyRound, 
  Share2, 
  RefreshCw, 
  ShieldAlert,
  Users
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  onTriggerSync: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab,
  syncStatus,
  onTriggerSync
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'files', label: 'File Storage', icon: FolderLock },
    { id: 'credentials', label: 'Credentials Vault', icon: KeyRound },
    { id: 'socials', label: 'Social Handles', icon: Share2 },
    { id: 'sync', label: 'Google Drive Sync', icon: RefreshCw },
  ];

  const getSyncBadge = () => {
    switch (syncStatus) {
      case 'syncing':
        return <span className="sync-badge syncing">Syncing...</span>;
      case 'synced':
        return <span className="sync-badge synced">Synced</span>;
      case 'error':
        return <span className="sync-badge error">Err</span>;
      default:
        return <span className="sync-badge idle">Offline</span>;
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="avatar" style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}>
          <FolderLock size={18} color="white" />
        </div>
        <h1>AuraVault</h1>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.id === 'sync' && getSyncBadge()}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-security-badge glass">
        <div className="security-icon-wrapper">
          <ShieldAlert size={16} className="pulse-icon" />
        </div>
        <div className="security-info">
          <h4>End-to-End</h4>
          <p>Local Encryption Active</p>
        </div>
      </div>

      <div className="sidebar-user">
        <div className="avatar">A</div>
        <div className="user-info">
          <span className="user-name">Alpha Team Admin</span>
          <span className="user-role">Super Admin</span>
        </div>
      </div>

      <style>{`
        .sidebar-security-badge {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          margin-bottom: 20px;
          border-radius: 12px;
          background: rgba(168, 85, 247, 0.05);
          border: 1px solid rgba(168, 85, 247, 0.15);
        }
        .security-icon-wrapper {
          color: var(--accent-purple);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .security-info h4 {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .security-info p {
          font-size: 10px;
          color: var(--text-muted);
        }
        .pulse-icon {
          animation: pulse 2s infinite ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        .sync-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 6px;
          margin-left: auto;
          font-weight: 600;
        }
        .sync-badge.syncing {
          background: rgba(6, 182, 212, 0.15);
          color: var(--accent-cyan);
          animation: blink 1.5s infinite;
        }
        .sync-badge.synced {
          background: rgba(16, 185, 129, 0.15);
          color: var(--accent-green);
        }
        .sync-badge.error {
          background: rgba(244, 63, 94, 0.15);
          color: var(--accent-red);
        }
        .sync-badge.idle {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
        }
        @keyframes blink {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </aside>
  );
};
