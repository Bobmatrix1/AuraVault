import React, { useState } from 'react';
import { 
  HardDrive,
  Trash2, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Settings,
  Database
} from 'lucide-react';
import { GDriveAccount } from '../utils/gdrive';

interface GoogleDriveSyncProps {
  connectedDrives: GDriveAccount[];
  onLinkDrive: (email: string, token: string, limit: number, usage: number) => void;
  onDisconnectDrive: (email: string) => void;
  onSetActiveDrive: (email: string) => void;
  toast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const GoogleDriveSync: React.FC<GoogleDriveSyncProps> = ({
  connectedDrives,
  onDisconnectDrive,
  toast
}) => {
  // Load Cloudflare R2 Configuration keys from local storage or environment fallbacks
  const [accountId, setAccountId] = useState(() => localStorage.getItem('r2_account_id') || import.meta.env.VITE_R2_ACCOUNT_ID || '');
  const [bucketName, setBucketName] = useState(() => localStorage.getItem('r2_bucket_name') || import.meta.env.VITE_R2_BUCKET_NAME || '');
  const [accessKeyId, setAccessKeyId] = useState(() => localStorage.getItem('r2_access_key_id') || import.meta.env.VITE_R2_ACCESS_KEY_ID || '');
  const [secretAccessKey, setSecretAccessKey] = useState(() => localStorage.getItem('r2_secret_access_key') || import.meta.env.VITE_R2_SECRET_ACCESS_KEY || '');
  
  const [isSaved, setIsSaved] = useState(() => !!(
    (localStorage.getItem('r2_account_id') || import.meta.env.VITE_R2_ACCOUNT_ID) &&
    (localStorage.getItem('r2_bucket_name') || import.meta.env.VITE_R2_BUCKET_NAME) &&
    (localStorage.getItem('r2_access_key_id') || import.meta.env.VITE_R2_ACCESS_KEY_ID) &&
    (localStorage.getItem('r2_secret_access_key') || import.meta.env.VITE_R2_SECRET_ACCESS_KEY)
  ));

  // Active Drive (corresponds to R2 bucket details passed in)
  const activeDrive = connectedDrives.find(d => d.isActive);

  // Format storage sizes
  const formatStorage = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const GB = 1024 * 1024 * 1024;
    const MB = 1024 * 1024;
    const KB = 1024;
    if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
    if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
    if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
    return `${bytes} Bytes`;
  };

  // Save R2 configurations to browser local storage
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId.trim() || !bucketName.trim() || !accessKeyId.trim() || !secretAccessKey.trim()) {
      toast('Please supply all R2 credentials fields', 'error');
      return;
    }
    localStorage.setItem('r2_account_id', accountId.trim());
    localStorage.setItem('r2_bucket_name', bucketName.trim());
    localStorage.setItem('r2_access_key_id', accessKeyId.trim());
    localStorage.setItem('r2_secret_access_key', secretAccessKey.trim());
    setIsSaved(true);
    toast('Cloudflare R2 configurations saved! Please refresh the page.', 'success');
    window.location.reload();
  };

  // Disconnect / Clear R2 configurations
  const handleClearConfig = () => {
    localStorage.removeItem('r2_account_id');
    localStorage.removeItem('r2_bucket_name');
    localStorage.removeItem('r2_access_key_id');
    localStorage.removeItem('r2_secret_access_key');
    setAccountId('');
    setBucketName('');
    setAccessKeyId('');
    setSecretAccessKey('');
    setIsSaved(false);
    onDisconnectDrive('Cloudflare R2 Bucket');
    toast('Cloudflare R2 disconnected. Vault is back in local-only mode.', 'info');
  };

  return (
    <div className="gdrive-sync-view">
      <div className="header-row">
        <div className="page-title">
          <h2>Cloudflare R2 Object Storage Manager</h2>
          <p>Encrypt and sync backups, credentials, and multimedia assets directly to your private, zero-egress Cloudflare R2 bucket.</p>
        </div>
      </div>

      <div className="sync-layout-grid">
        {/* Left Side: Linked Accounts Panel */}
        <div className="sync-col main-col">
          {/* Active Quota Card */}
          <div className="sync-card glass">
            <h3>Active R2 Storage Quota</h3>
            
            {activeDrive ? (
              <div className="active-quota-display">
                <div className="quota-header">
                  <div className="active-badge">
                    <CheckCircle size={12} /> Active Storage Target
                  </div>
                  <span className="active-email">{activeDrive.email}</span>
                </div>
                
                <div className="storage-meter-container" style={{ background: 'rgba(0,0,0,0.15)', marginTop: '16px' }}>
                  <div className="storage-info-row">
                    <div>
                      <span className="current-storage">{formatStorage(activeDrive.quotaUsage)}</span>
                      <span className="limit-storage"> of {formatStorage(activeDrive.quotaLimit)} used</span>
                    </div>
                    <span className="storage-percentage-text" style={{ color: 'var(--accent-cyan)' }}>
                      {(() => {
                        const pct = (activeDrive.quotaUsage / activeDrive.quotaLimit) * 100;
                        if (pct === 0) return '0.0%';
                        if (pct < 0.01) return `${pct.toFixed(3)}%`;
                        if (pct < 0.1) return `${pct.toFixed(2)}%`;
                        return `${pct.toFixed(1)}%`;
                      })()}
                    </span>
                  </div>
                  <div className="progress-container" style={{ height: '8px' }}>
                    <div 
                      className="progress-bar" 
                      style={{ 
                        width: `${Math.min(100, (activeDrive.quotaUsage / activeDrive.quotaLimit) * 100)}%`,
                        minWidth: activeDrive.quotaUsage > 0 ? '4px' : '0px',
                        background: 'linear-gradient(90deg, var(--accent-cyan) 0%, #0ea5e9 100%)' 
                      }}
                    />
                  </div>
                  <p className="remaining-quota-label">
                    Remaining Storage: <strong>{formatStorage(activeDrive.quotaLimit - activeDrive.quotaUsage)}</strong>
                  </p>
                </div>
              </div>
            ) : (
              <div className="empty-quota-state">
                <AlertCircle size={32} className="quota-alert-icon" />
                <p>No Cloudflare R2 bucket is connected. Vault is running in local-only offline mode (100MB limit).</p>
              </div>
            )}
          </div>

          {/* Connected Bucket Details List */}
          <div className="sync-card glass">
            <div className="card-header-flex">
              <h3>Active Storage Buckets ({connectedDrives.length})</h3>
            </div>

            {connectedDrives.length === 0 ? (
              <div className="empty-accounts-state">
                <p>No Cloudflare R2 bucket configured. Fill out the configuration panel to establish connection.</p>
              </div>
            ) : (
              <div className="accounts-list-container">
                {connectedDrives.map(account => {
                  const percentage = ((account.quotaUsage / account.quotaLimit) * 100).toFixed(1);
                  const remainingBytes = account.quotaLimit - account.quotaUsage;
                  const isFull = remainingBytes < 10 * 1024 * 1024; // Less than 10MB left

                  return (
                    <div 
                      key={account.email} 
                      className={`account-list-item glass active-outline`}
                    >
                      <div className="item-left">
                        <Database size={24} className="color-cyan" />
                        <div className="account-details">
                          <span className="account-email-label">{bucketName || 'auravault-storage'}</span>
                          <span className="account-meta-label">
                            Private S3-Compatible Cloudflare Bucket
                            {isFull && <span className="full-badge">FULL</span>}
                          </span>
                        </div>
                      </div>

                      <div className="item-middle">
                        <div className="mini-quota-bar">
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${percentage}%`, background: isFull ? 'var(--accent-red)' : 'var(--accent-cyan)' }} />
                          </div>
                          <span className="percentage-val">{percentage}% Used • {formatStorage(remainingBytes)} Left</span>
                        </div>
                      </div>

                      <div className="item-right">
                        <span className="active-pill-badge">Active</span>
                        
                        <button 
                          className="action-btn delete" 
                          onClick={() => {
                            if (confirm(`Are you sure you want to disconnect Cloudflare R2 bucket "${bucketName}"?`)) {
                              handleClearConfig();
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Setup Instructions / Config */}
        <div className="sync-col config-col">
          {/* R2 Configuration Form */}
          <div className="sync-card glass">
            <h3>Cloudflare R2 Credentials</h3>
            
            <form onSubmit={handleSaveConfig}>
              <div className="form-group">
                <label className="form-label">Account ID</label>
                <input 
                  type="text" 
                  className="input-glass font-mono"
                  placeholder="3499eaecb8a7b09c..."
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={isSaved}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Bucket Name</label>
                <input 
                  type="text" 
                  className="input-glass font-mono"
                  placeholder="auravault-storage"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  disabled={isSaved}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Access Key ID</label>
                <input 
                  type="text" 
                  className="input-glass font-mono"
                  placeholder="fffff317e70fa6844..."
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  disabled={isSaved}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Secret Access Key</label>
                <input 
                  type="password" 
                  className="input-glass font-mono"
                  placeholder="a7f33f036ada03868..."
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  disabled={isSaved}
                  required
                />
              </div>

              {isSaved ? (
                <div className="config-saved-message">
                  <CheckCircle size={14} color="var(--accent-green)" />
                  <span>Cloudflare R2 configuration is saved and active.</span>
                  <button type="button" className="text-btn" onClick={handleClearConfig}>Disconnect Bucket</button>
                </div>
              ) : (
                <button type="submit" className="btn btn-secondary btn-full">
                  Save & Connect R2
                </button>
              )}
            </form>
          </div>

          {/* Setup Tutorial */}
          <div className="sync-card glass info-tutorial-card">
            <div className="tutorial-header">
              <HelpCircle size={16} />
              <h4>R2 Quick Setup Guide</h4>
            </div>
            
            <ol className="tutorial-steps">
              <li>Log in to your <strong>Cloudflare Dashboard</strong>.</li>
              <li>Go to <strong>R2</strong> and create your bucket.</li>
              <li>Under Bucket <strong>Settings</strong>, configure CORS rules (expose ETag, allow AllowedOrigins).</li>
              <li>Go to <strong>Manage R2 API Tokens</strong> and click <strong>Create API Token</strong>.</li>
              <li>Create a token with <strong>Admin Read & Write</strong> permissions.</li>
              <li>Copy the Account ID, Bucket name, Access Key ID, and Secret Access Key and save them here.</li>
            </ol>
          </div>
        </div>
      </div>

      <style>{`
        .gdrive-sync-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .sync-layout-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 24px;
        }
        @media (max-width: 1100px) {
          .sync-layout-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .sync-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .sync-card {
          padding: 24px;
        }
        .sync-card h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .card-header-flex {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .form-group {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .config-saved-message {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .text-btn {
          background: none;
          border: none;
          color: var(--accent-pink);
          text-decoration: underline;
          cursor: pointer;
          font-size: 12px;
          padding: 0;
          font-weight: 600;
        }
        .active-quota-display {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .quota-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .active-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-green);
          background: rgba(34, 197, 94, 0.1);
          padding: 4px 8px;
          border-radius: 12px;
          border: 1px dashed var(--accent-green);
        }
        .active-email {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .storage-info-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .current-storage {
          font-weight: 700;
          color: var(--text-primary);
        }
        .limit-storage {
          color: var(--text-secondary);
        }
        .storage-percentage-text {
          font-weight: 700;
        }
        .remaining-quota-label {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 8px;
        }
        .empty-quota-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px 0;
          text-align: center;
        }
        .quota-alert-icon {
          color: var(--accent-pink);
        }
        .empty-quota-state p {
          font-size: 13px;
          color: var(--text-secondary);
          max-width: 320px;
        }
        .empty-accounts-state {
          padding: 40px 0;
          text-align: center;
          color: var(--text-secondary);
          font-size: 13px;
        }
        .accounts-list-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .account-list-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-radius: 12px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .item-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .account-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .account-email-label {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .account-meta-label {
          font-size: 11px;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .full-badge {
          background: rgba(239, 68, 68, 0.1);
          color: var(--accent-red);
          font-size: 9px;
          font-weight: 900;
          padding: 1px 4px;
          border-radius: 4px;
          border: 1px solid var(--accent-red);
        }
        .mini-quota-bar {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 180px;
        }
        .bar-track {
          height: 6px;
          background: rgba(255,255,255,0.08);
          border-radius: 3px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          border-radius: 3px;
        }
        .percentage-val {
          font-size: 10px;
          color: var(--text-secondary);
          text-align: right;
        }
        .item-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .active-pill-badge {
          font-size: 10px;
          font-weight: 700;
          color: var(--accent-cyan);
          background: rgba(6, 182, 212, 0.1);
          padding: 2px 8px;
          border-radius: 8px;
          border: 1px solid var(--accent-cyan);
        }
        .info-tutorial-card {
          border-left: 4px solid var(--accent-cyan);
        }
        .tutorial-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          color: var(--accent-cyan);
        }
        .tutorial-header h4 {
          font-size: 14px;
          font-weight: 700;
          margin: 0;
        }
        .tutorial-steps {
          padding-left: 20px;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .tutorial-steps a {
          color: var(--accent-cyan);
          text-decoration: underline;
        }
        .tutorial-steps code {
          background: rgba(255,255,255,0.06);
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};
