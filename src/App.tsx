import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { FileStorage } from './components/FileStorage';
import { CredentialVault } from './components/CredentialVault';
import { SocialHandles } from './components/SocialHandles';
import { GoogleDriveSync } from './components/GoogleDriveSync';
import { VaultLock } from './components/VaultLock';
import { FolderLock } from 'lucide-react';

import { 
  db, 
  VaultFile, 
  VaultCredential, 
  VaultSocialHandle, 
  VaultFolder 
} from './utils/db';

import { GDriveAccount, gdrive } from './utils/gdrive';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  
  // Database States
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [socials, setSocials] = useState<VaultSocialHandle[]>([]);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  
  // Multi-Drive Accounts
  const [connectedDrives, setConnectedDrives] = useState<GDriveAccount[]>(() => {
    const saved = localStorage.getItem('connected_drives');
    return saved ? JSON.parse(saved) : [];
  });

  // Sync state badge with connected drives
  useEffect(() => {
    localStorage.setItem('connected_drives', JSON.stringify(connectedDrives));
    if (connectedDrives.length > 0) {
      if (connectedDrives.some(d => d.isActive)) {
        setSyncStatus('synced');
      } else {
        setSyncStatus('idle');
      }
    } else {
      setSyncStatus('idle');
    }
  }, [connectedDrives]);

  // Get active upload target drive
  const activeDrive = connectedDrives.find(d => d.isActive) || null;
  
  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Modals shortcuts (triggered from dashboard)
  const [triggerCredDirectly, setTriggerCredDirectly] = useState(false);
  const [triggerSocialDirectly, setTriggerSocialDirectly] = useState(false);

  // Load database on start
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    try {
      const dbFiles = await db.getAll<VaultFile>('files');
      const dbCreds = await db.getAll<VaultCredential>('credentials');
      const dbSocials = await db.getAll<VaultSocialHandle>('socialHandles');
      const dbFolders = await db.getAll<VaultFolder>('folders');
      
      setFiles(dbFiles);
      setCredentials(dbCreds);
      setSocials(dbSocials);
      setFolders(dbFolders);
    } catch (err) {
      addToast('Failed to initialize local secure vault database', 'error');
    }
  };

  // Toast System
  const addToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove toast after 3.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // --- GOOGLE DRIVE MULTI-ACCOUNT MANAGEMENT ---
  const handleLinkDrive = (email: string, token: string, limit: number, usage: number, isDemo = false) => {
    setConnectedDrives(prev => {
      // Set any other accounts as inactive
      const updated = prev.map(d => ({ ...d, isActive: false }));
      // Insert new account and make it active
      updated.push({
        email,
        token,
        expiresAt: Date.now() + 3600 * 1000,
        quotaLimit: limit,
        quotaUsage: usage,
        isActive: true,
        isDemo
      });
      return updated;
    });
  };

  const handleDisconnectDrive = (email: string) => {
    setConnectedDrives(prev => {
      const filtered = prev.filter(d => d.email.toLowerCase() !== email.toLowerCase());
      // If we deleted the active one, make the first remaining one active
      if (filtered.length > 0 && !filtered.some(d => d.isActive)) {
        filtered[0].isActive = true;
      }
      return filtered;
    });
  };

  const handleSetActiveDrive = (email: string) => {
    setConnectedDrives(prev => {
      return prev.map(d => ({
        ...d,
        isActive: d.email.toLowerCase() === email.toLowerCase()
      }));
    });
  };

  // Direct cloud file downloader helper
  const handleDownloadCloudFile = async (file: VaultFile): Promise<string> => {
    if (!file.googleFileId || !file.driveEmail) {
      return file.dataUrl;
    }

    const targetDrive = connectedDrives.find(d => d.email === file.driveEmail);
    if (!targetDrive) {
      throw new Error('Associated Google Drive account is no longer connected');
    }

    try {
      const blob = await gdrive.downloadFile(file.googleFileId, targetDrive.token, targetDrive.isDemo);
      return URL.createObjectURL(blob);
    } catch (err: any) {
      if (err.message === 'DEMO_MODE_FALLBACK') {
        // Fall back to local Base64 cache kept for simulation files
        return file.dataUrl;
      }
      throw err;
    }
  };

  // --- CRUD OPERATIONS ---

  // Files
  const handleUploadFile = async (
    name: string, 
    size: number, 
    type: string, 
    dataUrl: string, 
    folderId: string | null,
    rawFile?: File,
    note?: string
  ) => {
    let googleFileId: string | undefined;
    let driveEmail: string | undefined;

    if (activeDrive) {
      setSyncStatus('syncing');
      try {
        // Get file blob/object
        let fileBlob: Blob | undefined = rawFile;
        if (!fileBlob && dataUrl) {
          const res = await fetch(dataUrl);
          fileBlob = await res.blob();
        }

        if (fileBlob) {
          // Direct Google Drive Upload (rest/simulation)
          googleFileId = await gdrive.uploadFile(
            { name, type, blob: fileBlob },
            activeDrive.token,
            activeDrive.isDemo
          );
          driveEmail = activeDrive.email;

          // Increment local quota counter for display
          setConnectedDrives(prev => 
            prev.map(d => d.email === activeDrive.email 
              ? { ...d, quotaUsage: d.quotaUsage + size } 
              : d
            )
          );
        }
      } catch (err) {
        addToast('Drive upload failed, saving to local offline storage.', 'error');
      } finally {
        setSyncStatus('synced');
      }
    }

    const newFile: VaultFile = {
      id: 'file_' + Math.random().toString(36).substr(2, 9),
      name,
      size,
      type,
      // For real cloud files, we save empty dataUrl to preserve local IndexedDB storage.
      // For demo mode simulation files, we keep the Base64 in memory so previews work offline.
      dataUrl: (googleFileId && !activeDrive?.isDemo) ? '' : dataUrl,
      folderId,
      createdAt: Date.now(),
      googleFileId,
      driveEmail,
      note
    };

    await db.put<VaultFile>('files', newFile);
    await refreshData();
  };

  const handleDeleteFile = async (id: string) => {
    const file = files.find(f => f.id === id);
    if (file && file.googleFileId && file.driveEmail) {
      const targetDrive = connectedDrives.find(d => d.email === file.driveEmail);
      if (targetDrive) {
        try {
          setSyncStatus('syncing');
          await gdrive.deleteFile(file.googleFileId, targetDrive.token, targetDrive.isDemo);
          
          // Deduct quota
          setConnectedDrives(prev => 
            prev.map(d => d.email === targetDrive.email 
              ? { ...d, quotaUsage: Math.max(0, d.quotaUsage - file.size) } 
              : d
            )
          );
        } catch (err) {
          console.error('Failed to delete file from Google Drive:', err);
        } finally {
          setSyncStatus('synced');
        }
      }
    }

    await db.delete('files', id);
    await refreshData();
  };

  const handleDeleteFolder = async (id: string) => {
    await db.delete('folders', id);
    const filesInFolder = files.filter(f => f.folderId === id);
    for (const file of filesInFolder) {
      await handleDeleteFile(file.id);
    }
    await refreshData();
  };

  const handleCreateFolder = async (name: string) => {
    const newFolder: VaultFolder = {
      id: 'folder_' + Math.random().toString(36).substr(2, 9),
      name,
      createdAt: Date.now()
    };
    await db.put<VaultFolder>('folders', newFolder);
    await refreshData();
  };

  // Credentials
  const handleAddCredential = async (cred: Omit<VaultCredential, 'id' | 'updatedAt'>) => {
    const newCred: VaultCredential = {
      ...cred,
      id: 'cred_' + Math.random().toString(36).substr(2, 9),
      updatedAt: Date.now()
    };
    await db.put<VaultCredential>('credentials', newCred);
    await refreshData();
  };

  const handleEditCredential = async (id: string, credUpdate: Partial<VaultCredential>) => {
    const original = credentials.find(c => c.id === id);
    if (!original) return;
    
    const updated: VaultCredential = {
      ...original,
      ...credUpdate,
      id,
      updatedAt: Date.now()
    };
    await db.put<VaultCredential>('credentials', updated);
    await refreshData();
  };

  const handleDeleteCredential = async (id: string) => {
    await db.delete('credentials', id);
    await refreshData();
  };

  // Social Handles
  const handleAddSocial = async (social: Omit<VaultSocialHandle, 'id' | 'updatedAt'>) => {
    const newSocial: VaultSocialHandle = {
      ...social,
      id: 'social_' + Math.random().toString(36).substr(2, 9),
      updatedAt: Date.now()
    };
    await db.put<VaultSocialHandle>('socialHandles', newSocial);
    await refreshData();
  };

  const handleEditSocial = async (id: string, socialUpdate: Partial<VaultSocialHandle>) => {
    const original = socials.find(s => s.id === id);
    if (!original) return;

    const updated: VaultSocialHandle = {
      ...original,
      ...socialUpdate,
      id,
      updatedAt: Date.now()
    };
    await db.put<VaultSocialHandle>('socialHandles', updated);
    await refreshData();
  };

  const handleDeleteSocial = async (id: string) => {
    await db.delete('socialHandles', id);
    await refreshData();
  };

  // Backup exporter/importer
  const handleExportBackup = (): string => {
    const payload = {
      files,
      credentials,
      socials,
      folders,
      exportVersion: 1.0,
      timestamp: Date.now()
    };
    return JSON.stringify(payload);
  };

  const handleImportBackup = async (jsonData: string): Promise<boolean> => {
    try {
      const data = JSON.parse(jsonData);
      if (!data || typeof data !== 'object') return false;
      if (!Array.isArray(data.files) || !Array.isArray(data.credentials) || !Array.isArray(data.socials)) {
        return false;
      }

      await db.clearStore('files');
      await db.clearStore('credentials');
      await db.clearStore('socialHandles');
      await db.clearStore('folders');

      for (const f of data.folders || []) {
        await db.put<VaultFolder>('folders', f);
      }
      for (const file of data.files) {
        await db.put<VaultFile>('files', file);
      }
      for (const cred of data.credentials) {
        await db.put<VaultCredential>('credentials', cred);
      }
      for (const soc of data.socials) {
        await db.put<VaultSocialHandle>('socialHandles', soc);
      }

      await refreshData();
      return true;
    } catch (err) {
      return false;
    }
  };

  // Render Page Content based on tab Selection
  const renderTabContent = () => {
    switch (activeTab) {
      case 'files':
        return (
          <FileStorage 
            files={files}
            folders={folders}
            onUploadFile={handleUploadFile}
            onCreateFolder={handleCreateFolder}
            onDeleteFile={handleDeleteFile}
            onDeleteFolder={handleDeleteFolder}
            onDownloadCloudFile={handleDownloadCloudFile}
            toast={addToast}
          />
        );
      case 'credentials':
        return (
          <CredentialVault 
            credentials={credentials}
            onAddCredential={handleAddCredential}
            onEditCredential={handleEditCredential}
            onDeleteCredential={handleDeleteCredential}
            toast={addToast}
            showAddModalDirectly={triggerCredDirectly}
            onCloseAddModalDirectly={() => setTriggerCredDirectly(false)}
          />
        );
      case 'socials':
        return (
          <SocialHandles 
            socials={socials}
            onAddSocial={handleAddSocial}
            onEditSocial={handleEditSocial}
            onDeleteSocial={handleDeleteSocial}
            toast={addToast}
            showAddModalDirectly={triggerSocialDirectly}
            onCloseAddModalDirectly={() => setTriggerSocialDirectly(false)}
          />
        );
      case 'sync':
        return (
          <GoogleDriveSync 
            connectedDrives={connectedDrives}
            onLinkDrive={handleLinkDrive}
            onDisconnectDrive={handleDisconnectDrive}
            onSetActiveDrive={handleSetActiveDrive}
            toast={addToast}
          />
        );
      default:
        return (
          <Dashboard 
            files={files}
            credentials={credentials}
            socials={socials}
            setActiveTab={setActiveTab}
            activeDrive={activeDrive}
            onOpenUploadModal={() => {
              setActiveTab('files');
              setTimeout(() => {
                const uploadBtn = document.querySelector('.btn-primary') as HTMLButtonElement;
                if (uploadBtn) uploadBtn.click();
              }, 100);
            }}
            onOpenCredModal={() => {
              setActiveTab('credentials');
              setTriggerCredDirectly(true);
            }}
            onOpenSocialModal={() => {
              setActiveTab('socials');
              setTriggerSocialDirectly(true);
            }}
          />
        );
    }
  };

  if (!isAuthenticated) {
    return (
      <VaultLock 
        onUnlock={() => {
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="app-layout">
      {/* Background Animated Blobs */}
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Mobile Top Header Bar */}
      <header className="mobile-top-bar glass">
        <div className="mobile-logo">
          <div className="avatar" style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)', width: '28px', height: '28px' }}>
            <FolderLock size={12} color="white" />
          </div>
          <span>AuraVault</span>
        </div>
        <button 
          className="mobile-menu-toggle-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Navigation Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        syncStatus={syncStatus}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onTriggerSync={async () => {
          if (!activeDrive) {
            setActiveTab('sync');
            addToast('Please connect a Google Drive to start synchronizing.', 'info');
            return;
          }
          setSyncStatus('syncing');
          try {
            // Upload current database snapshot payload to active drive
            const payload = handleExportBackup();
            await gdrive.uploadFile(
              { 
                name: `auravault_db_backup_${Date.now()}.json`, 
                type: 'application/json', 
                blob: new Blob([payload], { type: 'application/json' }) 
              },
              activeDrive.token,
              activeDrive.isDemo
            );
            addToast('Vault database synchronized with Google Drive', 'success');
          } catch (err) {
            addToast('Synchronization failed', 'error');
          } finally {
            setSyncStatus('synced');
          }
        }}
      />

      {/* Main Panel Viewport */}
      <main className="main-content">
        {renderTabContent()}
      </main>

      {/* Glassmorphic Toast Notification engine */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
