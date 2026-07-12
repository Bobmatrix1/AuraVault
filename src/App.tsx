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
import { db_firestore } from './utils/firebase';
import { encryptText, decryptText } from './utils/crypto';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

// Create a lightweight, downscaled JPG thumbnail from Base64 dataUrl for local DB cache
const createThumbnail = (dataUrl: string, maxWidth = 150, maxHeight = 150): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); // 0.6 quality is extremely lightweight!
      } else {
        resolve('');
      }
    };
    img.onerror = () => {
      resolve('');
    };
  });
};

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
  
  // PWA Install Prompts
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show install button if not already running in standalone app mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      if (!isStandalone) {
        setShowInstallBtn(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
      addToast('AuraVault has been installed successfully!', 'success');
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt' as any, handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    }
  };

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  // File Transfer Progress states
  const [transferProgress, setTransferProgress] = useState<number | null>(null);
  const [transferType, setTransferType] = useState<'upload' | 'download' | null>(null);
  const [transferFileName, setTransferFileName] = useState<string>('');

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

  // Encryption / Decryption wrapper helpers
  const passcode = import.meta.env.VITE_VAULT_PASSWORD || '2025';

  const encryptDoc = async (storeName: string, docData: any): Promise<any> => {
    const copy = { ...docData };
    if (storeName === 'credentials') {
      if (copy.username) copy.username = await encryptText(copy.username, passcode);
      if (copy.password) copy.password = await encryptText(copy.password, passcode);
      if (copy.note) copy.note = await encryptText(copy.note, passcode);
    } else if (storeName === 'socialHandles') {
      if (copy.password) copy.password = await encryptText(copy.password, passcode);
      if (copy.notes) copy.notes = await encryptText(copy.notes, passcode);
    } else if (storeName === 'files') {
      if (copy.note) copy.note = await encryptText(copy.note, passcode);
    }
    return copy;
  };

  const decryptDoc = async (storeName: string, docData: any): Promise<any> => {
    const copy = { ...docData };
    if (storeName === 'credentials') {
      if (copy.username) copy.username = await decryptText(copy.username, passcode);
      if (copy.password) copy.password = await decryptText(copy.password, passcode);
      if (copy.note) copy.note = await decryptText(copy.note, passcode);
    } else if (storeName === 'socialHandles') {
      if (copy.password) copy.password = await decryptText(copy.password, passcode);
      if (copy.notes) copy.notes = await decryptText(copy.notes, passcode);
    } else if (storeName === 'files') {
      if (copy.note) copy.note = await decryptText(copy.note, passcode);
    }
    return copy;
  };

  const writeData = async (storeName: string, id: string, docData: any) => {
    if (db_firestore) {
      try {
        const encrypted = await encryptDoc(storeName, docData);
        await setDoc(doc(db_firestore!, storeName, id), encrypted);
      } catch (err) {
        console.error(`Failed to write to Firestore collection "${storeName}":`, err);
        await db.put(storeName as any, docData);
        await refreshData();
      }
    } else {
      await db.put(storeName as any, docData);
      await refreshData();
      triggerPushSync();
    }
  };

  const deleteData = async (storeName: string, id: string) => {
    if (db_firestore) {
      try {
        await deleteDoc(doc(db_firestore!, storeName, id));
      } catch (err) {
        console.error(`Failed to delete from Firestore collection "${storeName}":`, err);
        await db.delete(storeName as any, id);
        await refreshData();
      }
    } else {
      await db.delete(storeName as any, id);
      await refreshData();
      triggerPushSync();
    }
  };

  // Listen to Firestore updates in real-time when authenticated
  useEffect(() => {
    if (!isAuthenticated || !db_firestore) return;

    const collections = ['folders', 'files', 'credentials', 'socialHandles'];
    const unsubscribes: (() => void)[] = [];

    collections.forEach((storeName) => {
      const colRef = collection(db_firestore!, storeName);
      const unsub = onSnapshot(colRef, async (snapshot) => {
        try {
          // Clear local cache for this store
          await db.clearStore(storeName as any);

          // Decrypt and cache all remote documents locally
          for (const docObj of snapshot.docs) {
            const rawData = docObj.data();
            const decryptedData = await decryptDoc(storeName, rawData);
            await db.put(storeName as any, decryptedData);
          }

          // Trigger state update
          await refreshData();
        } catch (err) {
          console.error(`Failed to synchronize "${storeName}" collection:`, err);
        }
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [isAuthenticated]);

  // Toast System
  const addToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove toast after 3.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Pull backup from Google Drive and restore database
  const triggerPullSync = async (token: string, isDemo = false) => {
    try {
      setSyncStatus('syncing');
      const filesList = await gdrive.listFiles(token, isDemo);
      if (filesList && filesList.length > 0) {
        const backupFiles = filesList.filter(f => f.name.startsWith('auravault_db_backup_'));
        if (backupFiles.length > 0) {
          // Sort by name descending
          backupFiles.sort((a, b) => b.name.localeCompare(a.name));
          const latestBackup = backupFiles[0];

          // Extract timestamp from filename
          const match = latestBackup.name.match(/auravault_db_backup_(\d+)\.json/);
          const remoteTime = match ? parseInt(match[1], 10) : 0;
          
          addToast('Found database backup on Google Drive. Syncing...', 'info');
          const blob = await gdrive.downloadFile(latestBackup.id, token, isDemo);
          const text = await blob.text();
          
          const success = await handleImportBackup(text);
          if (success) {
            localStorage.setItem('auravault_last_sync_time', remoteTime.toString());
            addToast('Vault database synchronized from Google Drive!', 'success');
          } else {
            addToast('Failed to restore database from backup file', 'error');
          }
        }
      }
    } catch (err) {
      console.error('Failed to pull backup from Google Drive:', err);
    } finally {
      setSyncStatus('synced');
    }
  };

  // Push database backup to Google Drive in the background (silent auto-sync)
  const triggerPushSync = async () => {
    const active = connectedDrives.find(d => d.isActive);
    if (!active) return;
    try {
      setSyncStatus('syncing');
      const payload = await handleExportBackup();
      const now = Date.now();
      
      await gdrive.uploadFile(
        { 
          name: `auravault_db_backup_${now}.json`, 
          type: 'application/json', 
          blob: new Blob([payload], { type: 'application/json' }) 
        },
        active.token,
        active.isDemo
      );
      
      localStorage.setItem('auravault_last_sync_time', now.toString());

      // Silently clean up older backups
      try {
        const filesList = await gdrive.listFiles(active.token, active.isDemo);
        const backupFiles = filesList.filter(f => f.name.startsWith('auravault_db_backup_'));
        if (backupFiles.length > 3) {
          backupFiles.sort((a, b) => b.name.localeCompare(a.name));
          const toDelete = backupFiles.slice(2);
          for (const f of toDelete) {
            await gdrive.deleteFile(f.id, active.token, active.isDemo);
          }
        }
      } catch (err) {
        console.error('Failed to clean up old backups during background push:', err);
      }
    } catch (err) {
      console.error('Failed to push database backup in background:', err);
    } finally {
      setSyncStatus('synced');
    }
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

    triggerPullSync(token, isDemo);
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

  // Master Drive auto-connection using environment refresh token on mount
  useEffect(() => {
    const cid = localStorage.getItem('gdrive_client_id') || import.meta.env.VITE_GCP_CLIENT_ID || '';
    const secret = import.meta.env.VITE_GCP_CLIENT_SECRET || '';
    const refreshToken = import.meta.env.VITE_GCP_REFRESH_TOKEN || '';

    if (cid && secret && refreshToken) {
      const autoConnect = async () => {
        try {
          setSyncStatus('syncing');
          const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: cid,
              client_secret: secret,
              refresh_token: refreshToken,
              grant_type: 'refresh_token'
            })
          });
          
          if (!response.ok) {
            console.error('Failed to auto-refresh master token');
            return;
          }
          
          const tokenData = await response.json();
          const token = tokenData.access_token;
          
          // Fetch quota and email details
          const details = await gdrive.fetchAccountDetails(token, false);
          
          // Link this master drive automatically
          handleLinkDrive(
            details.email,
            token,
            details.limit,
            details.usage,
            false // Not a demo
          );
        } catch (err) {
          console.error('Auto-connect master Google Drive failed:', err);
        } finally {
          setSyncStatus('synced');
        }
      };

      autoConnect();
    }
  }, []);

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
      setTransferType('download');
      setTransferFileName(file.name);
      setTransferProgress(0);

      const blob = await gdrive.downloadFile(
        file.googleFileId, 
        targetDrive.token, 
        targetDrive.isDemo,
        (pct) => setTransferProgress(pct)
      );

      setTransferProgress(null);
      setTransferType(null);
      return URL.createObjectURL(blob);
    } catch (err: any) {
      setTransferProgress(null);
      setTransferType(null);
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
          setTransferType('upload');
          setTransferFileName(name);
          setTransferProgress(0);

          // Direct Google Drive Upload (rest/simulation)
          googleFileId = await gdrive.uploadFile(
            { name, type, blob: fileBlob },
            activeDrive.token,
            activeDrive.isDemo,
            (pct) => setTransferProgress(pct)
          );
          
          setTransferProgress(null);
          setTransferType(null);
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

    let finalDataUrl = dataUrl;
    if (googleFileId && !activeDrive?.isDemo) {
      if (type.startsWith('image/')) {
        try {
          finalDataUrl = await createThumbnail(dataUrl);
        } catch (e) {
          finalDataUrl = '';
        }
      } else {
        finalDataUrl = '';
      }
    }

    const newFile: VaultFile = {
      id: 'file_' + Math.random().toString(36).substr(2, 9),
      name,
      size,
      type,
      // For real cloud files, we save a lightweight thumbnail dataUrl.
      // For demo mode simulation files, we keep the Base64 in memory so previews work offline.
      dataUrl: finalDataUrl,
      folderId,
      createdAt: Date.now(),
      googleFileId,
      driveEmail,
      note
    };

    await writeData('files', newFile.id, newFile);
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

    await deleteData('files', id);
  };

  const handleDeleteFolder = async (id: string) => {
    await deleteData('folders', id);
    const filesInFolder = files.filter(f => f.folderId === id);
    for (const file of filesInFolder) {
      await handleDeleteFile(file.id);
    }
  };

  const handleCreateFolder = async (name: string) => {
    const newFolder: VaultFolder = {
      id: 'folder_' + Math.random().toString(36).substr(2, 9),
      name,
      createdAt: Date.now()
    };
    await writeData('folders', newFolder.id, newFolder);
  };

  // Credentials
  const handleAddCredential = async (cred: Omit<VaultCredential, 'id' | 'updatedAt'>) => {
    const newCred: VaultCredential = {
      ...cred,
      id: 'cred_' + Math.random().toString(36).substr(2, 9),
      updatedAt: Date.now()
    };
    await writeData('credentials', newCred.id, newCred);
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
    await writeData('credentials', updated.id, updated);
  };

  const handleDeleteCredential = async (id: string) => {
    await deleteData('credentials', id);
  };

  // Social Handles
  const handleAddSocial = async (social: Omit<VaultSocialHandle, 'id' | 'updatedAt'>) => {
    const newSocial: VaultSocialHandle = {
      ...social,
      id: 'social_' + Math.random().toString(36).substr(2, 9),
      updatedAt: Date.now()
    };
    await writeData('socialHandles', newSocial.id, newSocial);
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
    await writeData('socialHandles', updated.id, updated);
  };

  const handleDeleteSocial = async (id: string) => {
    await deleteData('socialHandles', id);
  };

  // Backup exporter/importer
  const handleExportBackup = async (): Promise<string> => {
    const allFiles = await db.getAll<VaultFile>('files');
    const allCredentials = await db.getAll<VaultCredential>('credentials');
    const allSocials = await db.getAll<VaultSocialHandle>('socialHandles');
    const allFolders = await db.getAll<VaultFolder>('folders');

    const payload = {
      files: allFiles,
      credentials: allCredentials,
      socials: allSocials,
      folders: allFolders,
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
        showInstallBtn={showInstallBtn}
        onInstallPWA={handleInstallPWA}
        onTriggerSync={async () => {
          if (!activeDrive) {
            setActiveTab('sync');
            addToast('Please connect a Google Drive to start synchronizing.', 'info');
            return;
          }
          setSyncStatus('syncing');
          try {
            // 1. Fetch remote files list to check for newer remote updates
            const filesList = await gdrive.listFiles(activeDrive.token, activeDrive.isDemo);
            const backupFiles = filesList.filter(f => f.name.startsWith('auravault_db_backup_'));
            
            let lastSyncTime = parseInt(localStorage.getItem('auravault_last_sync_time') || '0', 10);
            let imported = false;

            if (backupFiles.length > 0) {
              backupFiles.sort((a, b) => b.name.localeCompare(a.name));
              const latestBackup = backupFiles[0];
              
              // Extract timestamp from filename
              const match = latestBackup.name.match(/auravault_db_backup_(\d+)\.json/);
              const remoteTime = match ? parseInt(match[1], 10) : 0;

              if (remoteTime > lastSyncTime) {
                addToast('Newer updates found on Google Drive. Pulling changes...', 'info');
                const blob = await gdrive.downloadFile(latestBackup.id, activeDrive.token, activeDrive.isDemo);
                const text = await blob.text();
                const success = await handleImportBackup(text);
                if (success) {
                  lastSyncTime = remoteTime;
                  localStorage.setItem('auravault_last_sync_time', remoteTime.toString());
                  imported = true;
                }
              }
            }

            // 2. Upload our latest state
            const now = Date.now();
            const payload = await handleExportBackup();
            await gdrive.uploadFile(
              { 
                name: `auravault_db_backup_${now}.json`, 
                type: 'application/json', 
                blob: new Blob([payload], { type: 'application/json' }) 
              },
              activeDrive.token,
              activeDrive.isDemo
            );
            
            localStorage.setItem('auravault_last_sync_time', now.toString());
            addToast(
              imported 
                ? 'Vault database synchronized (remote pulled and local uploaded)' 
                : 'Vault database uploaded to Google Drive (local up-to-date)', 
              'success'
            );

            // 3. Clean up old backups to save space (keep only the 3 latest backups)
            if (backupFiles.length > 3) {
              // Delete oldest backup files
              const toDelete = backupFiles.slice(2); // Keep the 2 latest
              for (const f of toDelete) {
                try {
                  await gdrive.deleteFile(f.id, activeDrive.token, activeDrive.isDemo);
                } catch (e) {
                  console.error('Failed to clean up old backup file:', e);
                }
              }
            }
          } catch (err) {
            addToast('Synchronization failed', 'error');
            console.error(err);
          } finally {
            setSyncStatus('synced');
          }
        }}
      />

      {/* Main Panel Viewport */}
      <main className="main-content">
        {renderTabContent()}
      </main>

      {/* File Transfer Progress Card */}
      {transferProgress !== null && (
        <div className="transfer-progress-card glass">
          <div className="transfer-info">
            <span className="transfer-icon-animate">
              {transferType === 'upload' ? '📤' : '📥'}
            </span>
            <span className="transfer-text">
              {transferType === 'upload' ? 'Uploading' : 'Downloading'} <strong>{transferFileName}</strong>...
            </span>
            <span className="transfer-pct">{transferProgress}%</span>
          </div>
          <div className="transfer-bar-container">
            <div className="transfer-bar" style={{ width: `${transferProgress}%` }}></div>
          </div>
        </div>
      )}

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
