import React, { useState, useRef } from 'react';
import { 
  Folder, 
  File, 
  FileText, 
  Image as ImageIcon, 
  Search, 
  Plus, 
  Upload, 
  Trash2, 
  Download, 
  Grid, 
  List, 
  FolderPlus, 
  ArrowLeft, 
  Eye, 
  FileUp, 
  Calendar, 
  HardDrive,
  RefreshCw,
  Cloud
} from 'lucide-react';
import { playSound } from '../utils/audio';
import { VaultFile, VaultFolder } from '../utils/db';

interface FileStorageProps {
  files: VaultFile[];
  folders: VaultFolder[];
  onUploadFile: (name: string, size: number, type: string, dataUrl: string, folderId: string | null, rawFile?: File, note?: string) => Promise<void>;
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteFile: (id: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onDownloadCloudFile: (file: VaultFile) => Promise<string>;
  toast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const FileStorage: React.FC<FileStorageProps> = ({
  files,
  folders,
  onUploadFile,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
  onDownloadCloudFile,
  toast
}) => {
  // Navigation & Search State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Modals & Upload State
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<VaultFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isFetchingCloud, setIsFetchingCloud] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenPreview = async (file: VaultFile) => {
    setPreviewFile(file);
    if (file.googleFileId) {
      setIsFetchingCloud(true);
      try {
        const url = await onDownloadCloudFile(file);
        setPreviewUrl(url);
      } catch (err) {
        toast('Failed to load file from Google Drive', 'error');
        setPreviewFile(null);
      } finally {
        setIsFetchingCloud(false);
      }
    } else {
      setPreviewUrl(file.dataUrl);
    }
  };

  // Filter folders and files based on selection
  const currentFolders = currentFolderId === null 
    ? folders 
    : []; // No subfolders in this simple structure, flat folder tree

  const currentFiles = files.filter(file => file.folderId === currentFolderId);

  // Search filter
  const filteredFiles = currentFiles.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredFolders = currentFolders.filter(folder => 
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Breadcrumb path
  const activeFolder = folders.find(f => f.id === currentFolderId);

  // File size format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [fileNote, setFileNote] = useState('');

  // Handle uploading files
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    
    if (file.size > 15 * 1024 * 1024) {
      toast('File is too large! Maximum limit is 15MB for browser storage.', 'error');
      return;
    }

    setPendingUploadFile(file);
    setFileNote('');
  };

  const handleConfirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUploadFile) return;

    setIsUploading(true);
    const file = pendingUploadFile;

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        await onUploadFile(file.name, file.size, file.type, dataUrl, currentFolderId, file, fileNote.trim());
        playSound.pop();
        setIsUploading(false);
        setPendingUploadFile(null);
        setFileNote('');
        toast(`"${file.name}" uploaded successfully`, 'success');
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.onerror = () => {
        toast('Failed to read file', 'error');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast('Error uploading file', 'error');
      setIsUploading(false);
    }
  };

  // Trigger file dialog
  const triggerUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle folder creation
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setShowFolderModal(false);
      toast(`Folder "${newFolderName}" created`, 'success');
    } catch (err) {
      toast('Failed to create folder', 'error');
    }
  };

  // Download file helper
  const downloadFile = async (file: VaultFile) => {
    try {
      let downloadUrl = file.dataUrl;
      if (file.googleFileId) {
        toast(`Fetching "${file.name}" from Google Drive...`, 'info');
        downloadUrl = await onDownloadCloudFile(file);
      }
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast('Download failed', 'error');
    }
  };

  // Select icon based on mime type
  const getFileIcon = (type: string, name: string) => {
    if (type.startsWith('image/')) {
      return <ImageIcon size={22} className="file-icon-img" />;
    }
    if (type.includes('pdf') || name.toLowerCase().endsWith('.pdf')) {
      return <FileText size={22} className="file-icon-pdf" />;
    }
    return <File size={22} className="file-icon-generic" />;
  };

  return (
    <div className="file-storage-view">
      {/* Top Header Row */}
      <div className="header-row">
        <div className="page-title">
          <h2>Cloud Storage</h2>
          <p>
            {currentFolderId === null ? 'Root Directory' : `Root / ${activeFolder?.name}`}
          </p>
        </div>

        <div className="header-actions">
          {/* View Mode Toggle */}
          <div className="view-toggle glass">
            <button 
              className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <Grid size={16} />
            </button>
            <button 
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <List size={16} />
            </button>
          </div>

          {currentFolderId === null && (
            <button className="btn btn-secondary" onClick={() => setShowFolderModal(true)}>
              <FolderPlus size={16} />
              <span>New Folder</span>
            </button>
          )}

          <button className="btn btn-primary" onClick={triggerUpload} disabled={isUploading}>
            <Upload size={16} />
            <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Breadcrumbs & Search */}
      <div className="navigation-bar glass">
        <div className="breadcrumb-nav">
          {currentFolderId !== null ? (
            <button className="back-btn btn btn-secondary" onClick={() => setCurrentFolderId(null)}>
              <ArrowLeft size={14} />
              <span>Back to Root</span>
            </button>
          ) : (
            <div className="root-label">
              <HardDrive size={16} />
              <span>All Workspace Assets</span>
            </div>
          )}
        </div>

        <div className="search-box-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search files & folders..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-glass search-input"
          />
        </div>
      </div>

      {/* Files Grid / List */}
      {filteredFiles.length === 0 && filteredFolders.length === 0 ? (
        <div className="empty-state glass">
          <FileUp size={48} className="empty-icon animate-bounce" />
          <h3>This vault is empty</h3>
          <p>Click "Upload File" or create a folder to secure your PDFs, documents and handle visuals.</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={triggerUpload}>
            Upload your first file
          </button>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="files-grid">
              {/* Folders */}
              {filteredFolders.map(folder => (
                <div 
                  key={folder.id} 
                  className="folder-card glass glass-hover"
                  onClick={() => setCurrentFolderId(folder.id)}
                >
                  <Folder size={36} className="folder-icon" />
                  <div className="folder-details">
                    <span className="folder-name">{folder.name}</span>
                    <span className="folder-meta">
                      {files.filter(f => f.folderId === folder.id).length} items
                    </span>
                  </div>
                  <button 
                    className="delete-item-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if(confirm(`Are you sure you want to delete folder "${folder.name}" and all its contents?`)) {
                        onDeleteFolder(folder.id);
                        toast(`Deleted folder "${folder.name}"`, 'info');
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* Files */}
              {filteredFiles.map(file => (
                <div key={file.id} className="file-card glass glass-hover">
                  <div className="file-preview-area" onClick={() => handleOpenPreview(file)}>
                    {file.type.startsWith('image/') ? (
                      <img src={file.dataUrl} alt={file.name} className="image-thumbnail" />
                    ) : (
                      <div className="file-icon-placeholder">
                        {getFileIcon(file.type, file.name)}
                      </div>
                    )}
                    <div className="hover-overlay">
                      <Eye size={20} color="white" />
                      <span>Preview</span>
                    </div>
                  </div>
                  
                  <div className="file-details">
                    <span className="file-name-label" title={file.name}>{file.name}</span>
                    <span className="file-meta-label">
                      {formatBytes(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                    </span>
                    {file.note && (
                      <span className="file-note-label" title={file.note}>{file.note}</span>
                    )}
                  </div>

                  <div className="file-actions">
                    <button className="file-action-btn" onClick={() => downloadFile(file)} title="Download">
                      <Download size={14} />
                    </button>
                    <button 
                      className="file-action-btn delete" 
                      onClick={() => {
                        if (confirm(`Delete file "${file.name}"?`)) {
                          onDeleteFile(file.id);
                          toast(`Deleted file "${file.name}"`, 'info');
                        }
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List View */
            <div className="files-list glass">
              <table className="files-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Uploaded</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Folders */}
                  {filteredFolders.map(folder => (
                    <tr 
                      key={folder.id} 
                      className="table-row folder-row" 
                      onClick={() => setCurrentFolderId(folder.id)}
                    >
                      <td>
                        <div className="table-cell-name">
                          <Folder size={18} className="folder-icon" />
                          <span>{folder.name}</span>
                        </div>
                      </td>
                      <td>Folder</td>
                      <td>—</td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="table-action-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            if(confirm(`Are you sure you want to delete folder "${folder.name}"?`)) {
                              onDeleteFolder(folder.id);
                              toast(`Deleted folder "${folder.name}"`, 'info');
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Files */}
                  {filteredFiles.map(file => (
                    <tr key={file.id} className="table-row file-row" onClick={() => handleOpenPreview(file)}>
                      <td>
                        <div className="table-cell-name">
                          {getFileIcon(file.type, file.name)}
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span title={file.name}>{file.name}</span>
                            {file.note && <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{file.note}</span>}
                          </div>
                        </div>
                      </td>
                      <td>{formatBytes(file.size)}</td>
                      <td>{new Date(file.createdAt).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div className="table-actions-container">
                          <button className="table-action-btn" onClick={() => downloadFile(file)}>
                            <Download size={14} />
                          </button>
                          <button 
                            className="table-action-btn delete"
                            onClick={() => {
                              if(confirm(`Delete "${file.name}"?`)) {
                                onDeleteFile(file.id);
                                toast(`Deleted "${file.name}"`, 'info');
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Folder Creation Modal */}
      {showFolderModal && (
        <div className="modal-overlay" onClick={() => setShowFolderModal(false)}>
          <form className="modal-content glass" onClick={(e) => e.stopPropagation()} onSubmit={handleCreateFolderSubmit}>
            <div className="modal-header">
              <h3 className="modal-title">Create Workspace Folder</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label">Folder Name</label>
              <input 
                type="text" 
                className="input-glass"
                placeholder="e.g. Social Handle Assets, Financial PDFs"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowFolderModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create Folder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Confirmation Modal */}
      {pendingUploadFile && (
        <div className="modal-overlay" onClick={() => setPendingUploadFile(null)}>
          <form className="modal-content glass" onClick={(e) => e.stopPropagation()} onSubmit={handleConfirmUpload}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm Document Upload</h3>
              <button type="button" className="close-btn" onClick={() => setPendingUploadFile(null)}>✕</button>
            </div>
            
            <div style={{ marginBottom: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <p>Uploading: <strong>{pendingUploadFile.name}</strong> ({formatBytes(pendingUploadFile.size)})</p>
            </div>

            <div className="form-group">
              <label className="form-label">Add Note / Description (Optional)</label>
              <textarea 
                className="input-glass"
                placeholder="What is this document/image for? e.g. Q4 Marketing Plan, Instagram branding visual..."
                value={fileNote}
                onChange={(e) => setFileNote(e.target.value)}
                rows={3}
                autoFocus
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setPendingUploadFile(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Confirm & Upload'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* File Preview Lightbox */}
      {previewFile && (
        <div className="modal-overlay" onClick={() => { setPreviewFile(null); setPreviewUrl(null); }}>
          <div className="modal-content glass preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{previewFile.name}</h3>
              <button className="close-btn" onClick={() => { setPreviewFile(null); setPreviewUrl(null); }}>✕</button>
            </div>

            <div className="preview-container">
              {isFetchingCloud ? (
                <div className="no-pdf-plugin">
                  <RefreshCw size={36} className="spin-icon" style={{ color: 'var(--accent-cyan)' }} />
                  <p>Streaming data from Google Drive...</p>
                </div>
              ) : previewFile.type.startsWith('image/') ? (
                <img src={previewUrl || ''} alt={previewFile.name} className="large-preview-image" />
              ) : previewFile.type.includes('pdf') || previewFile.name.endsWith('.pdf') ? (
                <object 
                  data={previewUrl || ''} 
                  type="application/pdf" 
                  width="100%" 
                  height="450px"
                  className="pdf-preview-object"
                >
                  <div className="no-pdf-plugin">
                    <FileText size={48} color="var(--accent-cyan)" />
                    <p>PDF preview is not supported by your browser plugin.</p>
                    <button type="button" className="btn btn-primary" onClick={() => downloadFile(previewFile)}>
                      Download PDF to View
                    </button>
                  </div>
                </object>
              ) : (
                <div className="no-preview-available">
                  <File size={64} className="file-icon-generic" />
                  <p>No preview is available for this file type ({previewFile.type || 'unknown'}).</p>
                  <button type="button" className="btn btn-primary" onClick={() => downloadFile(previewFile)}>
                    Download File
                  </button>
                </div>
              )}
            </div>

            {previewFile.note && (
              <div className="preview-note-bubble" style={{ marginBottom: '20px' }}>
                <strong>File Note:</strong>
                <p>{previewFile.note}</p>
              </div>
            )}

            <div className="preview-meta-row">
              <div className="meta-item">
                <HardDrive size={14} />
                <span>Size: {formatBytes(previewFile.size)}</span>
              </div>
              <div className="meta-item">
                <Calendar size={14} />
                <span>Uploaded: {new Date(previewFile.createdAt).toLocaleString()}</span>
              </div>
              {previewFile.googleFileId && (
                <div className="meta-item" style={{ color: 'var(--accent-cyan)' }}>
                  <Cloud size={14} />
                  <span>Cloud Stored</span>
                </div>
              )}
            </div>

            <div className="form-actions" style={{ marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => downloadFile(previewFile)} disabled={isFetchingCloud}>
                <Download size={14} />
                <span>Download</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={() => { setPreviewFile(null); setPreviewUrl(null); }}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .file-note-label {
          font-size: 11px;
          color: var(--accent-purple);
          background: rgba(168, 85, 247, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          margin-top: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: inline-block;
          max-width: 100%;
          border-left: 2px solid var(--accent-purple);
        }
        .preview-note-bubble {
          font-size: 12px;
          background: rgba(168, 85, 247, 0.04);
          border-left: 3px solid var(--accent-purple);
          padding: 10px 14px;
          border-radius: 0 8px 8px 0;
          color: var(--text-secondary);
          line-height: 1.5;
          text-align: left;
        }
        .preview-note-bubble strong {
          color: var(--text-primary);
          display: block;
          font-size: 11px;
          margin-bottom: 2px;
          text-transform: uppercase;
        }

        .file-storage-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .view-toggle {
          display: flex;
          padding: 4px;
          border-radius: 8px;
          gap: 2px;
        }
        .toggle-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 6px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: all 0.2s;
        }
        .toggle-btn.active {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
        }
        .navigation-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
        }
        .breadcrumb-nav {
          display: flex;
          align-items: center;
        }
        .root-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .back-btn {
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
        }
        .search-box-wrapper {
          position: relative;
          width: 300px;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .search-input {
          padding-left: 36px;
          padding-right: 12px;
          padding-top: 8px;
          padding-bottom: 8px;
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 40px;
          text-align: center;
          gap: 12px;
        }
        .empty-icon {
          color: var(--text-muted);
          margin-bottom: 12px;
        }
        .empty-state h3 {
          font-size: 18px;
          font-weight: 700;
        }
        .empty-state p {
          font-size: 14px;
          color: var(--text-secondary);
          max-width: 400px;
        }
        
        /* Files Grid */
        .files-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
        }
        @media (max-width: 768px) {
          .files-grid {
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 12px;
          }
        }
        
        /* Folder Card */
        .folder-card {
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          cursor: pointer;
          position: relative;
        }
        .folder-icon {
          color: var(--accent-purple);
          flex-shrink: 0;
        }
        .folder-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .folder-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .folder-meta {
          font-size: 11px;
          color: var(--text-secondary);
        }
        .delete-item-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s;
          padding: 6px;
          border-radius: 6px;
        }
        .folder-card:hover .delete-item-btn {
          opacity: 1;
        }
        .delete-item-btn:hover {
          color: var(--accent-red);
          background: rgba(244, 63, 94, 0.1);
        }

        /* File Card */
        .file-card {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }
        .file-preview-area {
          height: 120px;
          background: rgba(0,0,0,0.2);
          border-bottom: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          cursor: pointer;
          overflow: hidden;
        }
        .image-thumbnail {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .file-card:hover .image-thumbnail {
          transform: scale(1.05);
        }
        .file-icon-placeholder {
          font-size: 32px;
          opacity: 0.8;
        }
        .file-icon-img { color: var(--accent-pink); }
        .file-icon-pdf { color: var(--accent-cyan); }
        .file-icon-generic { color: var(--text-secondary); }
        
        .hover-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          opacity: 0;
          transition: opacity 0.2s ease;
          color: white;
          font-size: 12px;
          font-weight: 600;
        }
        .file-preview-area:hover .hover-overlay {
          opacity: 1;
        }

        .file-card .file-details {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .file-name-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .file-meta-label {
          font-size: 11px;
          color: var(--text-secondary);
        }
        .file-actions {
          padding: 8px 12px;
          border-top: 1px solid var(--border-light);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          background: rgba(255,255,255,0.01);
        }
        .file-action-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.15s;
        }
        .file-action-btn:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.05);
        }
        .file-action-btn.delete:hover {
          color: var(--accent-red);
          background: rgba(244, 63, 94, 0.15);
        }

        /* List View Details */
        .files-list {
          padding: 8px;
          overflow-x: auto;
        }
        .files-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 14px;
        }
        .files-table th {
          padding: 12px 16px;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--border-light);
        }
        .table-row {
          cursor: pointer;
          transition: background 0.2s;
        }
        .table-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .files-table td {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          color: var(--text-primary);
          vertical-align: middle;
        }
        .table-cell-name {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 600;
          min-width: 0;
        }
        .table-cell-name span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 250px;
        }
        .table-actions-container {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .table-action-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .table-action-btn:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.05);
        }
        .table-action-btn.delete:hover {
          color: var(--accent-red);
          background: rgba(244, 63, 94, 0.1);
        }
        
        /* Preview Modal styles */
        .preview-modal {
          max-width: 650px;
        }
        .preview-container {
          background: rgba(0,0,0,0.3);
          border: 1px solid var(--border-light);
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 250px;
          margin-bottom: 20px;
        }
        .large-preview-image {
          max-width: 100%;
          max-height: 450px;
          object-fit: contain;
        }
        .no-pdf-plugin, .no-preview-available {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 40px;
          text-align: center;
          font-size: 14px;
          color: var(--text-secondary);
        }
        .preview-meta-row {
          display: flex;
          gap: 24px;
          border-top: 1px solid var(--border-light);
          padding-top: 16px;
        }
        .meta-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
};
