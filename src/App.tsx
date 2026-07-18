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

import { r2, isR2Configured, resetS3Client } from './utils/r2';
import { db_firestore } from './utils/firebase';
import { encryptText, decryptText } from './utils/crypto';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

interface GDriveAccount {
  email: string;
  token: string;
  expiresAt: number;
  quotaLimit: number;
  quotaUsage: number;
  isActive: boolean;
  isDemo?: boolean;
}

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
  
  // Cloudflare R2 connection details
  const [r2Details, setR2Details] = useState<{ email: string; limit: number; usage: number } | null>(null);
  const [r2Connected, setR2Connected] = useState<boolean>(isR2Configured());

  // Compute active storage drive based on Cloudflare R2 configuration
  const activeDrive: GDriveAccount | null = r2Connected && r2Details ? {
    email: r2Details.email, // "Cloudflare R2 Bucket"
    token: 'r2-active-token',
    expiresAt: Date.now() + 3600 * 1000,
    quotaLimit: r2Details.limit,
    quotaUsage: r2Details.usage,
    isActive: true,
    isDemo: false
  } : null;

  const connectedDrives = activeDrive ? [activeDrive] : [];

  // Sync state badge with connected drives
  useEffect(() => {
    if (r2Connected && r2Details) {
      setSyncStatus('synced');
    } else {
      setSyncStatus('idle');
    }
  }, [r2Connected, r2Details]);
  
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

  const sanitizeForFirestore = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    const copy = { ...obj };
    Object.keys(copy).forEach(key => {
      if (copy[key] === undefined) {
        delete copy[key];
      } else if (copy[key] !== null && typeof copy[key] === 'object' && !Array.isArray(copy[key])) {
        copy[key] = sanitizeForFirestore(copy[key]);
      }
    });
    return copy;
  };

  const writeData = async (storeName: string, id: string, docData: any) => {
    if (db_firestore) {
      try {
        const encrypted = await encryptDoc(storeName, docData);
        const sanitized = sanitizeForFirestore(encrypted);
        await setDoc(doc(db_firestore!, storeName, id), sanitized);
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

  // Refresh R2 bucket credentials and storage usage statistics
  const refreshR2Details = async () => {
    if (isR2Configured()) {
      try {
        resetS3Client();
        const details = await r2.fetchBucketDetails();
        setR2Details(details);
        setR2Connected(true);
      } catch (err) {
        console.error('Failed to refresh Cloudflare R2 bucket details:', err);
        setR2Details(null);
        setR2Connected(false);
      }
    } else {
      setR2Details(null);
      setR2Connected(false);
    }
  };

  // Pull backup from Cloudflare R2 and restore database
  const triggerPullSync = async () => {
    if (!isR2Configured()) return;
    try {
      setSyncStatus('syncing');
      const backupFiles = await r2.listFiles();
      if (backupFiles && backupFiles.length > 0) {
        const dbBackups = backupFiles.filter(f => f.name.startsWith('auravault_db_backup_'));
        if (dbBackups.length > 0) {
          // Sort descending to find the newest database state
          dbBackups.sort((a, b) => b.name.localeCompare(a.name));
          const latestBackup = dbBackups[0];
          
          const match = latestBackup.name.match(/auravault_db_backup_(\d+)\.json/);
          const remoteTime = match ? parseInt(match[1], 10) : 0;
          
          let lastSyncTime = parseInt(localStorage.getItem('auravault_last_sync_time') || '0', 10);
          if (remoteTime > lastSyncTime) {
            addToast('Found database backup on Cloudflare R2. Syncing...', 'info');
            const blob = await r2.downloadFile(latestBackup.id);
            const text = await blob.text();
            const success = await handleImportBackup(text);
            if (success) {
              localStorage.setItem('auravault_last_sync_time', remoteTime.toString());
              addToast('Vault database synchronized from Cloudflare R2!', 'success');
            } else {
              addToast('Failed to restore database from backup file', 'error');
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to pull backup from Cloudflare R2:', err);
    } finally {
      setSyncStatus('synced');
    }
  };

  // Push database backup to Cloudflare R2 in the background (silent auto-sync)
  const triggerPushSync = async () => {
    if (!isR2Configured()) return;
    try {
      setSyncStatus('syncing');
      const payload = await handleExportBackup();
      const now = Date.now();
      
      await r2.uploadFile({ 
        name: `auravault_db_backup_${now}.json`, 
        type: 'application/json', 
        blob: new Blob([payload], { type: 'application/json' }) 
      });
      
      localStorage.setItem('auravault_last_sync_time', now.toString());

      // Silently clean up older backups to save space
      try {
        const backupFiles = await r2.listFiles();
        const dbBackups = backupFiles.filter(f => f.name.startsWith('auravault_db_backup_'));
        if (dbBackups.length > 3) {
          dbBackups.sort((a, b) => b.name.localeCompare(a.name));
          const toDelete = dbBackups.slice(2);
          for (const f of toDelete) {
            await r2.deleteFile(f.id);
          }
        }
      } catch (err) {
        console.error('Failed to clean up old backups in R2:', err);
      }
    } catch (err) {
      console.error('Failed to push database backup to Cloudflare R2:', err);
    } finally {
      setSyncStatus('synced');
    }
  };

  // --- CLOUDFLARE R2 BUCKET MANAGEMENT ---
  const handleLinkDrive = async (email: string, token: string, limit: number, usage: number) => {
    await refreshR2Details();
  };

  const handleDisconnectDrive = (email: string) => {
    localStorage.removeItem('r2_account_id');
    localStorage.removeItem('r2_bucket_name');
    localStorage.removeItem('r2_access_key_id');
    localStorage.removeItem('r2_secret_access_key');
    resetS3Client();
    setR2Details(null);
    setR2Connected(false);
  };

  const handleSetActiveDrive = (email: string) => {
    // No-op for Cloudflare R2
  };

  // Startup initialization: sync with active Cloudflare R2 bucket and refresh quota
  useEffect(() => {
    const initR2Storage = async () => {
      if (isR2Configured()) {
        try {
          resetS3Client();
          const details = await r2.fetchBucketDetails();
          setR2Details(details);
          setR2Connected(true);
          await triggerPullSync();
        } catch (e) {
          console.error('Failed to initialize Cloudflare R2 storage on startup:', e);
        }
      }
    };
    initR2Storage();
  }, []);

  // Direct cloud file downloader helper
  const handleDownloadCloudFile = async (file: VaultFile): Promise<string> => {
    if (!file.googleFileId) {
      return file.dataUrl;
    }

    try {
      setTransferType('download');
      setTransferFileName(file.name);
      setTransferProgress(0);

      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        if (currentProgress < 95) {
          currentProgress += Math.max(1, Math.round((95 - currentProgress) * 0.15));
          setTransferProgress(currentProgress);
        }
      }, 100);

      try {
        const blob = await r2.downloadFile(
          file.googleFileId, 
          (pct) => {
            const capped = Math.min(99, pct);
            if (capped > currentProgress) {
              currentProgress = capped;
              setTransferProgress(capped);
            }
          }
        );

        clearInterval(progressInterval);
        setTransferProgress(100);
        await new Promise(resolve => setTimeout(resolve, 300));
        return URL.createObjectURL(blob);
      } catch (dlErr) {
        clearInterval(progressInterval);
        throw dlErr;
      } finally {
        setTransferProgress(null);
        setTransferType(null);
      }
    } catch (err: any) {
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

          let currentProgress = 0;
          const progressInterval = setInterval(() => {
            if (currentProgress < 95) {
              currentProgress += Math.max(1, Math.round((95 - currentProgress) * 0.15));
              setTransferProgress(currentProgress);
            }
          }, 100);

          try {
            googleFileId = await r2.uploadFile(
              { name, type, blob: fileBlob },
              (pct) => {
                const capped = Math.min(99, pct);
                if (capped > currentProgress) {
                  currentProgress = capped;
                  setTransferProgress(capped);
                }
              }
            );
            
            clearInterval(progressInterval);
            setTransferProgress(100);
            await new Promise(resolve => setTimeout(resolve, 300));

            // Fetch updated R2 quota details
            r2.fetchBucketDetails().then(details => {
              setR2Details(details);
            }).catch(console.error);

          } catch (uploadErr) {
            clearInterval(progressInterval);
            throw uploadErr;
          } finally {
            setTransferProgress(null);
            setTransferType(null);
          }

          driveEmail = activeDrive.email;
        }
      } catch (err) {
        addToast('R2 upload failed, saving to local offline storage.', 'error');
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
    if (file && file.googleFileId && isR2Configured()) {
      try {
        setSyncStatus('syncing');
        await r2.deleteFile(file.googleFileId);
        
        // Fetch updated R2 quota details
        r2.fetchBucketDetails().then(details => {
          setR2Details(details);
        }).catch(console.error);
      } catch (err) {
        console.error('Failed to delete file from Cloudflare R2:', err);
      } finally {
        setSyncStatus('synced');
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
          if (!isR2Configured()) {
            setActiveTab('sync');
            addToast('Please connect Cloudflare R2 to start synchronizing.', 'info');
            return;
          }
          setSyncStatus('syncing');
          try {
            // 1. Fetch remote files list to check for newer remote updates
            const backupFiles = await r2.listFiles();
            const dbBackups = backupFiles.filter(f => f.name.startsWith('auravault_db_backup_'));
            
            let lastSyncTime = parseInt(localStorage.getItem('auravault_last_sync_time') || '0', 10);
            let imported = false;
 
            if (dbBackups.length > 0) {
              dbBackups.sort((a, b) => b.name.localeCompare(a.name));
              const latestBackup = dbBackups[0];
              
              // Extract timestamp from filename
              const match = latestBackup.name.match(/auravault_db_backup_(\d+)\.json/);
              const remoteTime = match ? parseInt(match[1], 10) : 0;
 
              if (remoteTime > lastSyncTime) {
                addToast('Newer updates found on Cloudflare R2. Pulling changes...', 'info');
                const blob = await r2.downloadFile(latestBackup.id);
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
            await r2.uploadFile({ 
              name: `auravault_db_backup_${now}.json`, 
              type: 'application/json', 
              blob: new Blob([payload], { type: 'application/json' }) 
            });
            
            localStorage.setItem('auravault_last_sync_time', now.toString());
            addToast(
              imported 
                ? 'Vault database synchronized (remote pulled and local uploaded)' 
                : 'Vault database uploaded to Cloudflare R2 (local up-to-date)', 
              'success'
            );
 
            // 3. Clean up old backups to save space (keep only the 3 latest backups)
            if (dbBackups.length > 3) {
              const toDelete = dbBackups.slice(2); // Keep the 2 latest
              for (const f of toDelete) {
                try {
                  await r2.deleteFile(f.id);
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
