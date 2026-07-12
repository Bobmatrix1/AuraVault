import React from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Key, 
  Share2, 
  Cloud, 
  ArrowUpRight, 
  HardDrive,
  Clock,
  ExternalLink
} from 'lucide-react';
import { VaultFile, VaultCredential, VaultSocialHandle } from '../utils/db';
import { GDriveAccount } from '../utils/gdrive';

interface DashboardProps {
  files: VaultFile[];
  credentials: VaultCredential[];
  socials: VaultSocialHandle[];
  setActiveTab: (tab: string) => void;
  activeDrive: GDriveAccount | null;
  onOpenUploadModal?: () => void;
  onOpenCredModal?: () => void;
  onOpenSocialModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  files,
  credentials,
  socials,
  setActiveTab,
  activeDrive,
  onOpenUploadModal,
  onOpenCredModal,
  onOpenSocialModal
}) => {
  // Calculations
  const totalFiles = files.length;
  const totalCreds = credentials.length;
  const totalSocials = socials.length;
  
  const totalSizeBytes = files.reduce((acc, file) => acc + file.size, 0);
  
  // Decide limits based on Google Drive active connection
  const isCloudActive = activeDrive !== undefined && activeDrive !== null;
  const storageLimitBytes = isCloudActive ? activeDrive.quotaLimit : 100 * 1024 * 1024; // 100MB local fallback
  const storageUsedBytes = isCloudActive ? activeDrive.quotaUsage : totalSizeBytes;

  const GB = 1024 * 1024 * 1024;
  const MB = 1024 * 1024;
  const KB = 1024;

  const formatUnits = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
    if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
    if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
    return `${bytes} Bytes`;
  };

  const totalSizeLabel = formatUnits(storageUsedBytes);
  const storageLimitLabel = formatUnits(storageLimitBytes);
  const storagePercentage = Math.min((storageUsedBytes / storageLimitBytes) * 100, 100);

  // Categorize files
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  const pdfFiles = files.filter(f => f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf'));
  const otherFiles = files.filter(f => !imageFiles.includes(f) && !pdfFiles.includes(f));

  const imageSize = (imageFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2);
  const pdfSize = (pdfFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2);
  const otherSize = (otherFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2);

  // Format bytes helper
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Recent activity
  const recentFiles = [...files].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  const recentCreds = [...credentials].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);

  return (
    <div className="dashboard-view">
      <div className="header-row">
        <div className="page-title">
          <h2>Welcome to Aura Vault</h2>
          <p>Secure digital HQ for your team's sensitive credentials and company assets.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid-dashboard">
        <div className="stat-card glass glass-hover" onClick={() => setActiveTab('files')}>
          <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--accent-cyan)' }}>
            <HardDrive size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalFiles}</span>
            <span className="stat-label">Stored Files</span>
          </div>
          <ArrowUpRight size={18} className="card-arrow" />
        </div>

        <div className="stat-card glass glass-hover" onClick={() => setActiveTab('credentials')}>
          <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.12)', color: 'var(--accent-purple)' }}>
            <Key size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalCreds}</span>
            <span className="stat-label">Secure Credentials</span>
          </div>
          <ArrowUpRight size={18} className="card-arrow" />
        </div>

        <div className="stat-card glass glass-hover" onClick={() => setActiveTab('socials')}>
          <div className="stat-icon" style={{ background: 'rgba(236, 72, 153, 0.12)', color: 'var(--accent-pink)' }}>
            <Share2 size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalSocials}</span>
            <span className="stat-label">Social Handles</span>
          </div>
          <ArrowUpRight size={18} className="card-arrow" />
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="dashboard-content-layout">
        {/* Left Side: Storage details & Quick Actions */}
        <div className="layout-col main-col">
          {/* Storage Overview */}
          <div className="dashboard-section glass">
            <h3>{isCloudActive ? `Google Drive Quota (${activeDrive.email})` : 'Local Vault Storage Allocation'}</h3>
            <div className="storage-meter-container">
              <div className="storage-info-row">
                <div>
                  <span className="current-storage">{totalSizeLabel}</span>
                  <span className="limit-storage"> of {storageLimitLabel} used</span>
                </div>
                <span className="storage-percentage-text">
                  {(() => {
                    if (storagePercentage === 0) return '0.0%';
                    if (storagePercentage < 0.01) return `${storagePercentage.toFixed(3)}%`;
                    if (storagePercentage < 0.1) return `${storagePercentage.toFixed(2)}%`;
                    return `${storagePercentage.toFixed(1)}%`;
                  })()}
                </span>
              </div>
              <div className="progress-container" style={{ height: '10px' }}>
                <div 
                  className="progress-bar" 
                  style={{ 
                    width: `${storagePercentage}%`,
                    minWidth: storagePercentage > 0 ? '4px' : '0px',
                    background: 'linear-gradient(90deg, var(--accent-cyan) 0%, var(--accent-purple) 100%)' 
                  }}
                />
              </div>
            </div>

            {/* Storage Breakdown Row */}
            <div className="storage-breakdown">
              <div className="breakdown-item">
                <div className="breakdown-color" style={{ background: 'var(--accent-cyan)' }}></div>
                <div className="breakdown-details">
                  <span className="breakdown-label">PDF Documents</span>
                  <span className="breakdown-value">{pdfFiles.length} files • {pdfSize} MB</span>
                </div>
              </div>
              <div className="breakdown-item">
                <div className="breakdown-color" style={{ background: 'var(--accent-pink)' }}></div>
                <div className="breakdown-details">
                  <span className="breakdown-label">Images & Media</span>
                  <span className="breakdown-value">{imageFiles.length} files • {imageSize} MB</span>
                </div>
              </div>
              <div className="breakdown-item">
                <div className="breakdown-color" style={{ background: 'var(--accent-purple)' }}></div>
                <div className="breakdown-details">
                  <span className="breakdown-label">Other Files</span>
                  <span className="breakdown-value">{otherFiles.length} files • {otherSize} MB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="dashboard-section glass">
            <h3>Quick Actions</h3>
            <div className="quick-actions-grid">
              <button className="action-btn glass glass-hover" onClick={onOpenUploadModal}>
                <div className="action-icon-bg" style={{ background: 'rgba(6, 182, 212, 0.1)' }}>
                  <Cloud size={20} color="var(--accent-cyan)" />
                </div>
                <h4>Upload Document</h4>
                <p>Add PDF reports or asset images</p>
              </button>

              <button className="action-btn glass glass-hover" onClick={onOpenCredModal}>
                <div className="action-icon-bg" style={{ background: 'rgba(168, 85, 247, 0.1)' }}>
                  <Key size={20} color="var(--accent-purple)" />
                </div>
                <h4>Store Password</h4>
                <p>Register database or server creds</p>
              </button>

              <button className="action-btn glass glass-hover" onClick={onOpenSocialModal}>
                <div className="action-icon-bg" style={{ background: 'rgba(236, 72, 153, 0.1)' }}>
                  <Share2 size={20} color="var(--accent-pink)" />
                </div>
                <h4>Link Social Handle</h4>
                <p>Track handle permissions & logins</p>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Recent Activity */}
        <div className="layout-col sidebar-col">
          <div className="dashboard-section glass recent-activity-panel">
            <h3>Recent Vault Activity</h3>
            
            <div className="activity-list">
              <h4 className="activity-subheader"><Clock size={12} /> Recent Files</h4>
              {recentFiles.length === 0 ? (
                <p className="no-activity-msg">No files uploaded yet.</p>
              ) : (
                recentFiles.map(file => (
                  <div key={file.id} className="activity-item" onClick={() => setActiveTab('files')}>
                    <div className="activity-icon-container pdf">
                      {file.type.includes('pdf') || file.name.endsWith('.pdf') ? (
                        <FileText size={16} color="var(--accent-cyan)" />
                      ) : (
                        <ImageIcon size={16} color="var(--accent-pink)" />
                      )}
                    </div>
                    <div className="activity-item-details">
                      <span className="activity-name">{file.name}</span>
                      <span className="activity-meta">{formatBytes(file.size)} • {new Date(file.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}

              <h4 className="activity-subheader" style={{ marginTop: '20px' }}><Key size={12} /> Recent Credentials</h4>
              {recentCreds.length === 0 ? (
                <p className="no-activity-msg">No credentials saved yet.</p>
              ) : (
                recentCreds.map(cred => (
                  <div key={cred.id} className="activity-item" onClick={() => setActiveTab('credentials')}>
                    <div className="activity-icon-container cred">
                      <Key size={16} color="var(--accent-purple)" />
                    </div>
                    <div className="activity-item-details">
                      <span className="activity-name">{cred.name}</span>
                      <span className="activity-meta">User: {cred.username} • {new Date(cred.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .dashboard-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .card-arrow {
          position: absolute;
          top: 16px;
          right: 16px;
          opacity: 0.3;
          transition: all 0.2s ease;
          color: var(--text-primary);
        }
        .stat-card {
          cursor: pointer;
          position: relative;
        }
        .stat-card:hover .card-arrow {
          opacity: 1;
          transform: translate(2px, -2px);
          color: var(--accent-purple);
        }
        .dashboard-content-layout {
          display: flex;
          gap: 24px;
        }
        .layout-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .layout-col.main-col {
          flex: 2;
        }
        .layout-col.sidebar-col {
          flex: 1;
        }
        .dashboard-section {
          padding: 24px;
        }
        .dashboard-section h3 {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 20px;
          color: var(--text-primary);
          letter-spacing: -0.2px;
        }
        .storage-meter-container {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-light);
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .storage-info-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 8px;
        }
        .current-storage {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .limit-storage {
          font-size: 12px;
          color: var(--text-secondary);
        }
        .storage-percentage-text {
          font-size: 14px;
          font-weight: 700;
          color: var(--accent-purple);
        }
        .storage-breakdown {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .breakdown-item {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.01);
        }
        .breakdown-color {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 5px;
          flex-shrink: 0;
        }
        .breakdown-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .breakdown-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .breakdown-value {
          font-size: 11px;
          color: var(--text-secondary);
        }
        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .action-btn {
          padding: 20px 16px;
          border-radius: 12px;
          text-align: left;
          cursor: pointer;
          border: 1px solid var(--border-light);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        .action-icon-bg {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }
        .action-btn h4 {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .action-btn p {
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .recent-activity-panel {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .activity-list {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }
        .activity-subheader {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .no-activity-msg {
          font-size: 12px;
          color: var(--text-muted);
          padding: 8px 0;
        }
        .activity-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          margin-bottom: 8px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.01);
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .activity-item:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        .activity-icon-container {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .activity-icon-container.pdf {
          background: rgba(6, 182, 212, 0.08);
        }
        .activity-icon-container.cred {
          background: rgba(168, 85, 247, 0.08);
        }
        .activity-item-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .activity-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .activity-meta {
          font-size: 11px;
          color: var(--text-secondary);
        }
        @media (max-width: 1024px) {
          .dashboard-content-layout {
            flex-direction: column;
          }
          .quick-actions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
