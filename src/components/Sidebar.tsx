import React from 'react';
import { 
  LayoutDashboard, 
  FolderLock, 
  KeyRound, 
  Share2, 
  RefreshCw, 
  ShieldAlert,
  Users,
  Download
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  onTriggerSync: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  showInstallBtn?: boolean;
  onInstallPWA?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab,
  syncStatus,
  onTriggerSync,
  mobileOpen,
  onCloseMobile,
  showInstallBtn,
  onInstallPWA
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'files', label: 'File Storage', icon: FolderLock },
    { id: 'credentials', label: 'Credentials Vault', icon: KeyRound },
    { id: 'socials', label: 'Social Handles', icon: Share2 },
    { id: 'sync', label: 'Cloudflare R2 Sync', icon: RefreshCw },
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
    <>
      {mobileOpen && (
        <div className="sidebar-mobile-backdrop" onClick={onCloseMobile}></div>
      )}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="avatar" style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}>
            <FolderLock size={18} color="white" />
          </div>
          <h1>AuraVault</h1>
          {mobileOpen && (
            <button className="mobile-close-sidebar-btn" onClick={onCloseMobile}>✕</button>
          )}
        </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.id === 'sync' && getSyncBadge()}
            </button>
          );
        })}
      </nav>

      {showInstallBtn && (
        <button className="btn btn-primary install-pwa-btn" onClick={onInstallPWA}>
          <Download size={14} />
          <span>Download App</span>
        </button>
      )}

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

        .mobile-close-sidebar-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 18px;
          cursor: pointer;
          margin-left: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
        }
        .mobile-close-sidebar-btn:hover {
          color: var(--text-primary);
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            width: var(--sidebar-width);
            height: 100vh;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 10005;
            background: rgba(10, 11, 20, 0.96);
            box-shadow: 5px 0 25px rgba(0, 0, 0, 0.5);
            border-right: 1px solid var(--border-light);
            border-bottom: none;
            padding: 24px;
          }
          .sidebar.mobile-open {
            transform: translateX(0);
          }
          .sidebar-mobile-backdrop {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 10004;
            animation: fadeIn 0.2s ease;
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        }

        .install-pwa-btn {
          width: 100%;
          margin-bottom: 16px;
          font-size: 13px;
          padding: 10px 14px;
          background: linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%);
          border: none;
          box-shadow: 0 4px 15px rgba(6, 182, 212, 0.25);
        }
        .install-pwa-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(6, 182, 212, 0.4);
        }
      `}</style>
      </aside>
    </>
  );
};
