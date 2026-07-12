import React, { useState } from 'react';
import { 
  Cloud, 
  Trash2, 
  CheckCircle, 
  HelpCircle, 
  Plus, 
  HardDrive, 
  RefreshCw, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { GDriveAccount, gdrive, isGCPConfigured } from '../utils/gdrive';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleDriveSyncProps {
  connectedDrives: GDriveAccount[];
  onLinkDrive: (email: string, token: string, limit: number, usage: number, isDemo?: boolean) => void;
  onDisconnectDrive: (email: string) => void;
  onSetActiveDrive: (email: string) => void;
  toast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const GoogleDriveSync: React.FC<GoogleDriveSyncProps> = ({
  connectedDrives,
  onLinkDrive,
  onDisconnectDrive,
  onSetActiveDrive,
  toast
}) => {
  // GCP Credentials
  const [clientId, setClientId] = useState(() => localStorage.getItem('gdrive_client_id') || '');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gdrive_api_key') || '');
  const [isSaved, setIsSaved] = useState(() => !!(localStorage.getItem('gdrive_client_id') && localStorage.getItem('gdrive_api_key')));
  
  // Custom manual token entry
  const [customToken, setCustomToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Active Drive
  const activeDrive = connectedDrives.find(d => d.isActive);

  // Format bytes helper
  const formatStorage = (bytes: number) => {
    const GB = 1024 * 1024 * 1024;
    if (bytes >= GB) {
      return `${(bytes / GB).toFixed(2)} GB`;
    }
    const MB = 1024 * 1024;
    return `${(bytes / MB).toFixed(1)} MB`;
  };

  // Save GCP configuration
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !apiKey.trim()) {
      toast('Please supply both Client ID and API Key', 'error');
      return;
    }
    localStorage.setItem('gdrive_client_id', clientId.trim());
    localStorage.setItem('gdrive_api_key', apiKey.trim());
    setIsSaved(true);
    toast('Google Drive configurations updated', 'success');
  };

  // Clear credentials
  const handleClearConfig = () => {
    localStorage.removeItem('gdrive_client_id');
    localStorage.removeItem('gdrive_api_key');
    setClientId('');
    setApiKey('');
    setIsSaved(false);
    toast('API credentials cleared. Vault is back to local/simulation mode.', 'info');
  };

  // Connect via manual OAuth Token
  const handleConnectWithToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customToken.trim()) return;

    setIsConnecting(true);
    toast('Connecting to Google Drive API...', 'info');

    try {
      const details = await gdrive.fetchAccountDetails(customToken.trim(), false);
      
      // Check if already connected
      if (connectedDrives.some(d => d.email.toLowerCase() === details.email.toLowerCase())) {
        toast(`Account ${details.email} is already connected`, 'error');
        setIsConnecting(false);
        return;
      }

      onLinkDrive(
        details.email,
        customToken.trim(),
        details.limit,
        details.usage,
        false // Not a demo
      );
      setCustomToken('');
      setShowTokenInput(false);
      toast(`Successfully linked Google Drive: ${details.email}`, 'success');
    } catch (err) {
      toast('Failed to authorize token. Check if token is expired.', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  // Load Google Script
  const loadGoogleScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      const existingScript = document.getElementById('google-gsi-client');
      if (existingScript) {
        existingScript.onload = () => resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  };

  // Trigger Google Sign-In Popup
  const handleGoogleOAuthLogin = async () => {
    if (!clientId.trim()) {
      toast('Please enter and save your GCP Client ID in the configuration panel first.', 'error');
      setShowTokenInput(true); // Toggle manual input as fallback
      return;
    }

    setIsConnecting(true);
    toast('Opening Google Account Consent...', 'info');

    try {
      await loadGoogleScript();
      
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            toast('Google Sign-In failed or was cancelled', 'error');
            setIsConnecting(false);
            return;
          }

          const accessToken = tokenResponse.access_token;
          toast('Fetching account profile and storage quotas...', 'info');

          try {
            const details = await gdrive.fetchAccountDetails(accessToken, false);

            if (connectedDrives.some(d => d.email.toLowerCase() === details.email.toLowerCase())) {
              toast(`Drive account (${details.email}) is already linked.`, 'info');
              setIsConnecting(false);
              return;
            }

            onLinkDrive(details.email, accessToken, details.limit, details.usage, false);
            toast(`Successfully linked Google Drive: ${details.email}`, 'success');
            setShowTokenInput(false);
          } catch (err) {
            toast('Failed to fetch account info using Google token', 'error');
          } finally {
            setIsConnecting(false);
          }
        },
      });

      client.requestAccessToken();
    } catch (err) {
      toast('Failed to initialize Google login popup', 'error');
      setIsConnecting(false);
      setShowTokenInput(true); // show manual entry fallback
    }
  };

  // Simulate Linking a Demo Drive Account (for sandbox preview)
  const handleConnectDemoDrive = async () => {
    setIsConnecting(true);
    toast('Opening Google Accounts Consent (Simulation)...', 'info');

    setTimeout(() => {
      // Create random demo email to show multi-drive functionality
      const names = ['hq-vault', 'design-archive', 'finance-drives', 'marketing-backup'];
      const chosen = names[Math.floor(Math.random() * names.length)];
      const email = `${chosen}@company.com`;

      if (connectedDrives.some(d => d.email.toLowerCase() === email.toLowerCase())) {
        toast(`Account ${email} is already connected`, 'error');
        setIsConnecting(false);
        return;
      }

      // Generate random mock quota usage (e.g. 1.2GB to 14.5GB used)
      const limit = 15 * 1024 * 1024 * 1024; // 15 GB
      const usage = Math.floor((1.5 + Math.random() * 12) * 1024 * 1024 * 1024);

      onLinkDrive(email, 'demo_token_' + Math.random().toString(36).substr(2, 6), limit, usage, true);
      setIsConnecting(false);
      toast(`Successfully linked Demo Google Drive: ${email}`, 'success');
    }, 1200);
  };

  return (
    <div className="gdrive-sync-view">
      <div className="header-row">
        <div className="page-title">
          <h2>Google Drive Multi-Account Manager</h2>
          <p>Link multiple Google Drives. Upload directly to Google Cloud, stream previews, and scale capacity dynamically.</p>
        </div>
      </div>

      <div className="sync-layout-grid">
        {/* Left Side: Linked Accounts Panel */}
        <div className="sync-col main-col">
          {/* Active Quota Card */}
          <div className="sync-card glass">
            <h3>Active Drive Quota</h3>
            
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
                      {((activeDrive.quotaUsage / activeDrive.quotaLimit) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="progress-container" style={{ height: '8px' }}>
                    <div 
                      className="progress-bar" 
                      style={{ 
                        width: `${(activeDrive.quotaUsage / activeDrive.quotaLimit) * 100}%`,
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
                <p>No Google Drive is set as the active storage target. Vault is running in local-only offline mode (100MB max limit).</p>
              </div>
            )}
          </div>

          {/* Connected Accounts List */}
          <div className="sync-card glass">
            <div className="card-header-flex">
              <h3>Linked Accounts ({connectedDrives.length})</h3>
              
              <div className="account-actions-flex">
                <button className="btn btn-secondary btn-sm" onClick={handleConnectDemoDrive} disabled={isConnecting}>
                  <Plus size={12} />
                  <span>Connect Demo Drive</span>
                </button>
                
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={handleGoogleOAuthLogin} 
                  disabled={isConnecting}
                >
                  <Cloud size={12} />
                  <span>Link Google OAuth</span>
                </button>
              </div>
            </div>

            {showTokenInput && (
              <form className="token-manual-form" onSubmit={handleConnectWithToken}>
                <label className="form-label">Google OAuth Access Token</label>
                <div className="token-input-row">
                  <input 
                    type="password" 
                    className="input-glass font-mono"
                    placeholder="ya29.a0AfH6SM..."
                    value={customToken}
                    onChange={(e) => setCustomToken(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-primary" disabled={isConnecting}>
                    {isConnecting ? 'Linking...' : 'Link Account'}
                  </button>
                </div>
                <p className="token-tip-text">
                  Paste a valid access token generated from your Google GCP OAuth Consent workflow.
                </p>
                <div style={{ textAlign: 'right', marginTop: '10px' }}>
                  <span 
                    onClick={() => setShowTokenInput(false)} 
                    style={{ fontSize: '11px', color: 'var(--accent-red)', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Cancel manual entry
                  </span>
                </div>
              </form>
            )}

            {!showTokenInput && (
              <div style={{ padding: '0 24px 16px 24px', textAlign: 'right' }}>
                <span 
                  onClick={() => setShowTokenInput(true)} 
                  style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Manually paste OAuth Access Token instead
                </span>
              </div>
            )}

            {connectedDrives.length === 0 ? (
              <div className="empty-accounts-state">
                <p>No Google Drive accounts connected yet. Link an account to start direct cloud uploads.</p>
              </div>
            ) : (
              <div className="accounts-list-container">
                {connectedDrives.map(account => {
                  const percentage = ((account.quotaUsage / account.quotaLimit) * 100).toFixed(1);
                  const remainingBytes = account.quotaLimit - account.quotaUsage;
                  const isFull = remainingBytes < 100 * 1024 * 1024; // Less than 100MB left

                  return (
                    <div 
                      key={account.email} 
                      className={`account-list-item glass ${account.isActive ? 'active-outline' : ''}`}
                    >
                      <div className="item-left">
                        <HardDrive size={24} className={account.isActive ? 'color-cyan' : 'color-muted'} />
                        <div className="account-details">
                          <span className="account-email-label">{account.email}</span>
                          <span className="account-meta-label">
                            {account.isDemo ? 'Simulation Demo Drive' : 'Google Cloud Platform Drive'}
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
                        {!account.isActive ? (
                          <button 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => onSetActiveDrive(account.email)}
                            disabled={isFull}
                          >
                            Set Active
                          </button>
                        ) : (
                          <span className="active-pill-badge">Active Target</span>
                        )}
                        
                        <button 
                          className="action-btn delete" 
                          onClick={() => {
                            if (confirm(`Are you sure you want to disconnect Google Drive "${account.email}"?`)) {
                              onDisconnectDrive(account.email);
                              toast(`Disconnected "${account.email}"`, 'info');
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
          {/* GCP Configuration */}
          <div className="sync-card glass">
            <h3>GCP Project Configuration</h3>
            
            <form onSubmit={handleSaveConfig}>
              <div className="form-group">
                <label className="form-label">Google Client ID</label>
                <input 
                  type="text" 
                  className="input-glass font-mono"
                  placeholder="xxxxxx-xxxxxxxx.apps.googleusercontent.com"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={isSaved}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Google API Key</label>
                <input 
                  type="password" 
                  className="input-glass font-mono"
                  placeholder="AIzaSyXXXXXXXXXXXXXXXXXX"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isSaved}
                  required
                />
              </div>

              {isSaved ? (
                <div className="config-saved-message">
                  <CheckCircle size={14} color="var(--accent-green)" />
                  <span>Google Client configuration is saved.</span>
                  <button type="button" className="text-btn" onClick={handleClearConfig}>Edit Credentials</button>
                </div>
              ) : (
                <button type="submit" className="btn btn-secondary btn-full">
                  Save Credentials
                </button>
              )}
            </form>
          </div>

          {/* Setup Tutorial */}
          <div className="sync-card glass info-tutorial-card">
            <div className="tutorial-header">
              <HelpCircle size={16} />
              <h4>OAuth Quick Reference</h4>
            </div>
            
            <ol className="tutorial-steps">
              <li>Open the <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">GCP Console</a>.</li>
              <li>Enable the <strong>Google Drive API</strong>.</li>
              <li>Set up your **OAuth Consent Screen** (external or internal).</li>
              <li>Under **Credentials**, create:
                <ul>
                  <li>**API Key** (restrict to Drive API).</li>
                  <li>**OAuth Client ID** (Web application).</li>
                </ul>
              </li>
              <li>Add <code>http://localhost:5173</code> to Origins and Redirect URIs.</li>
              <li>Generate an Access Token to connect individual drives securely.</li>
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
        .account-actions-flex {
          display: flex;
          gap: 8px;
        }
        
        /* Quota styles */
        .active-quota-display {
          display: flex;
          flex-direction: column;
          gap: 4px;
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
          font-size: 10px;
          font-weight: 800;
          color: var(--accent-green);
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          padding: 4px 10px;
          border-radius: 99px;
          text-transform: uppercase;
        }
        .active-email {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .remaining-quota-label {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 12px;
          text-align: right;
        }
        .remaining-quota-label strong {
          color: var(--text-primary);
        }
        
        .empty-quota-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px;
          text-align: center;
          gap: 12px;
          color: var(--text-secondary);
          font-size: 13px;
        }
        .quota-alert-icon {
          color: var(--accent-amber);
        }
        
        /* Token Form */
        .token-manual-form {
          background: rgba(0,0,0,0.15);
          border: 1px solid var(--border-light);
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .token-input-row {
          display: flex;
          gap: 12px;
        }
        .token-tip-text {
          font-size: 11px;
          color: var(--text-muted);
        }
        
        /* Connected Accounts list */
        .empty-accounts-state {
          text-align: center;
          padding: 32px;
          font-size: 13px;
          color: var(--text-muted);
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
          padding: 16px;
          gap: 16px;
        }
        .account-list-item.active-outline {
          border-color: var(--accent-cyan);
          box-shadow: inset 0 0 10px rgba(6, 182, 212, 0.05);
        }
        .item-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1.5;
          min-width: 0;
        }
        .color-cyan { color: var(--accent-cyan); }
        .color-muted { color: var(--text-muted); }
        .account-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .account-email-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .account-meta-label {
          font-size: 11px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .full-badge {
          background: rgba(244, 63, 94, 0.15);
          color: var(--accent-red);
          font-size: 8px;
          font-weight: 900;
          padding: 1px 4px;
          border-radius: 4px;
        }
        
        .item-middle {
          flex: 1;
          display: flex;
          align-items: center;
        }
        .mini-quota-bar {
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 100%;
        }
        .mini-quota-bar .bar-track {
          width: 100%;
          height: 4px;
          background: rgba(255,255,255,0.05);
          border-radius: 99px;
          overflow: hidden;
        }
        .mini-quota-bar .bar-fill {
          height: 100%;
          border-radius: 99px;
        }
        .percentage-val {
          font-size: 10px;
          color: var(--text-secondary);
          font-weight: 600;
        }
        
        .item-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .active-pill-badge {
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-cyan);
          background: rgba(6, 182, 212, 0.08);
          border: 1px solid rgba(6, 182, 212, 0.2);
          padding: 4px 12px;
          border-radius: 6px;
        }
        .action-btn.delete {
          padding: 6px;
          border-radius: 6px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
        }
        .action-btn.delete:hover {
          color: var(--accent-red);
          background: rgba(244, 63, 94, 0.15);
        }
        
        /* Right sidebar config message */
        .config-saved-message {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.15);
          padding: 10px 12px;
          border-radius: 8px;
          margin-top: 8px;
        }
        .text-btn {
          background: transparent;
          border: none;
          color: var(--accent-purple);
          font-weight: 700;
          cursor: pointer;
          font-size: 12px;
          margin-left: 6px;
        }
        .text-btn:hover {
          text-decoration: underline;
        }
        .btn-full { width: 100%; }

        .info-tutorial-card {
          background: rgba(168, 85, 247, 0.02);
          border: 1px solid rgba(168, 85, 247, 0.1);
        }
        .tutorial-header {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--accent-purple);
          margin-bottom: 12px;
        }
        .tutorial-header h4 {
          font-size: 13px;
          font-weight: 700;
        }
        .tutorial-steps {
          font-size: 12px;
          color: var(--text-secondary);
          padding-left: 18px;
          line-height: 1.6;
        }
        .tutorial-steps li {
          margin-bottom: 8px;
        }
        .tutorial-steps a {
          color: var(--accent-cyan);
          text-decoration: none;
          font-weight: 600;
        }
        .tutorial-steps a:hover {
          text-decoration: underline;
        }
        .tutorial-steps ul {
          padding-left: 14px;
          margin-top: 4px;
          list-style-type: circle;
        }
      `}</style>
    </div>
  );
};
