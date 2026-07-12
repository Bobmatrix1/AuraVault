import React, { useState } from 'react';
import { 
  Share2, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Globe,
  Settings
} from 'lucide-react';
import { VaultSocialHandle } from '../utils/db';
import { playSound } from '../utils/audio';

interface SocialHandlesProps {
  socials: VaultSocialHandle[];
  onAddSocial: (social: Omit<VaultSocialHandle, 'id' | 'updatedAt'>) => Promise<void>;
  onEditSocial: (id: string, social: Partial<VaultSocialHandle>) => Promise<void>;
  onDeleteSocial: (id: string) => Promise<void>;
  toast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  showAddModalDirectly?: boolean;
  onCloseAddModalDirectly?: () => void;
}

export const SocialHandles: React.FC<SocialHandlesProps> = ({
  socials,
  onAddSocial,
  onEditSocial,
  onDeleteSocial,
  toast,
  showAddModalDirectly = false,
  onCloseAddModalDirectly
}) => {
  const [showAddModal, setShowAddModal] = useState(showAddModalDirectly);
  const [editingSocial, setEditingSocial] = useState<VaultSocialHandle | null>(null);
  
  // UI states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Form Inputs
  const [platform, setPlatform] = useState('Twitter');
  const [username, setUsername] = useState('');
  const [handleUrl, setHandleUrl] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Editor');
  const [status, setStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (showAddModalDirectly) {
      setShowAddModal(true);
    }
  }, [showAddModalDirectly]);

  const handleCopy = (text: string, id: string) => {
    playSound.copy();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast('Copied successfully', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const platforms = [
    'Twitter', 'Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'GitHub', 'Other'
  ];

  const getPlatformColors = (plat: string) => {
    switch (plat.toLowerCase()) {
      case 'twitter': return { bg: 'rgba(29, 161, 242, 0.1)', border: 'rgba(29, 161, 242, 0.3)', text: '#1da1f2' };
      case 'instagram': return { bg: 'rgba(225, 48, 108, 0.1)', border: 'rgba(225, 48, 108, 0.3)', text: '#e1306c' };
      case 'facebook': return { bg: 'rgba(66, 103, 178, 0.1)', border: 'rgba(66, 103, 178, 0.3)', text: '#4267b2' };
      case 'linkedin': return { bg: 'rgba(0, 119, 181, 0.1)', border: 'rgba(0, 119, 181, 0.3)', text: '#0077b5' };
      case 'tiktok': return { bg: 'rgba(255, 0, 80, 0.1)', border: 'rgba(255, 0, 80, 0.3)', text: '#ff0050' };
      case 'youtube': return { bg: 'rgba(255, 0, 0, 0.1)', border: 'rgba(255, 0, 0, 0.3)', text: '#ff0000' };
      case 'github': return { bg: 'rgba(240, 246, 252, 0.05)', border: 'rgba(240, 246, 252, 0.15)', text: '#f0f6fc' };
      default: return { bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.3)', text: '#a855f7' };
    }
  };

  const openAddModal = () => {
    setEditingSocial(null);
    setPlatform('Twitter');
    setUsername('');
    setHandleUrl('');
    setPassword('');
    setRole('Editor');
    setStatus('active');
    setNotes('');
    setShowAddModal(true);
  };

  const openEditModal = (social: VaultSocialHandle) => {
    setEditingSocial(social);
    setPlatform(social.platform);
    setUsername(social.username);
    setHandleUrl(social.handleUrl || '');
    setPassword(social.password || '');
    setRole(social.role);
    setStatus(social.status);
    setNotes(social.notes || '');
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingSocial(null);
    if (onCloseAddModalDirectly) {
      onCloseAddModalDirectly();
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast('Username is required', 'error');
      return;
    }

    try {
      if (editingSocial) {
        await onEditSocial(editingSocial.id, {
          platform,
          username: username.trim(),
          handleUrl: handleUrl.trim() || undefined,
          password: password || undefined,
          role,
          status,
          notes: notes.trim() || undefined,
          updatedAt: Date.now()
        });
        toast(`Social handle "@${username}" updated`, 'success');
      } else {
        await onAddSocial({
          platform,
          username: username.trim(),
          handleUrl: handleUrl.trim() || undefined,
          password: password || undefined,
          role,
          status,
          notes: notes.trim() || undefined
        });
        toast(`Social handle "@${username}" linked`, 'success');
      }
      closeModal();
    } catch (err) {
      toast('Failed to save social details', 'error');
    }
  };

  return (
    <div className="social-handles-view">
      <div className="header-row">
        <div className="page-title">
          <h2>Social Handles</h2>
          <p>Administer team roles, track marketing handle states, and access profile logins.</p>
        </div>

        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} />
          <span>Link Handle</span>
        </button>
      </div>

      {socials.length === 0 ? (
        <div className="empty-state glass">
          <Share2 size={48} className="empty-icon animate-pulse" />
          <h3>No social profiles linked</h3>
          <p>Consolidate your brand profiles. Store 2FA recovery backup codes, passwords, and staff access roles.</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAddModal}>
            Link brand profile
          </button>
        </div>
      ) : (
        <div className="social-grid">
          {socials.map(social => {
            const colors = getPlatformColors(social.platform);
            const isPasswordVisible = visiblePasswords[social.id] || false;

            return (
              <div key={social.id} className="social-card glass glass-hover">
                <div className="card-top-row">
                  <span 
                    className="platform-badge" 
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  >
                    {social.platform}
                  </span>
                  
                  <div className="social-status-badges">
                    {social.status === 'active' && (
                      <span className="status-badge active">
                        <ShieldCheck size={10} /> Active
                      </span>
                    )}
                    {social.status === 'suspended' && (
                      <span className="status-badge suspended">
                        <AlertTriangle size={10} /> Alert
                      </span>
                    )}
                    {social.status === 'inactive' && (
                      <span className="status-badge inactive">
                        Archived
                      </span>
                    )}
                  </div>
                </div>

                <div className="handle-identity">
                  <h3>@{social.username}</h3>
                  {social.handleUrl && (
                    <a 
                      href={social.handleUrl.startsWith('http') ? social.handleUrl : `https://${social.handleUrl}`}
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="profile-link"
                    >
                      <span>Visit Profile</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>

                <div className="team-assignment-box">
                  <div className="info-item">
                    <span className="info-label">Assigned Owner</span>
                    <span className="info-value">{social.role}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Last Checked</span>
                    <span className="info-value">{new Date(social.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {social.password && (
                  <div className="social-password-box font-mono">
                    <div className="pwd-col">
                      <Lock size={12} className="lock-icon" />
                      <input 
                        type={isPasswordVisible ? 'text' : 'password'} 
                        value={social.password} 
                        readOnly 
                        className="social-pass-field"
                      />
                    </div>
                    <div className="pwd-actions">
                      <button className="copy-field-btn" onClick={() => togglePasswordVisibility(social.id)}>
                        {isPasswordVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button className="copy-field-btn" onClick={() => handleCopy(social.password || '', social.id)}>
                        {copiedId === social.id ? (
                          <Check size={12} color="var(--accent-green)" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {social.notes && (
                  <div className="social-notes-bubble">
                    <strong>Notes & 2FA:</strong>
                    <p>{social.notes}</p>
                  </div>
                )}

                <div className="social-card-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(social)}>
                    <Edit3 size={12} /> Edit
                  </button>
                  <button 
                    className="btn btn-danger btn-sm" 
                    onClick={() => {
                      if(confirm(`Are you sure you want to remove "@${social.username}"?`)) {
                        onDeleteSocial(social.id);
                        toast(`Removed "@${social.username}"`, 'info');
                      }
                    }}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Social Handle Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <form className="modal-content glass" onClick={(e) => e.stopPropagation()} onSubmit={handleFormSubmit}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingSocial ? 'Modify Linked Profile' : 'Link Brand Profile'}
              </h3>
              <button type="button" className="close-btn" onClick={closeModal}>✕</button>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Platform *</label>
                <select 
                  className="input-glass select-custom"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  {platforms.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Username / Handle *</label>
                <div className="input-prefix-wrapper">
                  <span className="input-prefix-at">@</span>
                  <input 
                    type="text" 
                    className="input-glass input-with-prefix"
                    placeholder="companybrand"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Profile URL</label>
              <input 
                type="text" 
                className="input-glass"
                placeholder="e.g. twitter.com/mycompany"
                value={handleUrl}
                onChange={(e) => setHandleUrl(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Profile Password (Optional)</label>
              <input 
                type="text" 
                className="input-glass font-mono"
                placeholder="Direct login password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Team Access / Role</label>
                <select 
                  className="input-glass select-custom"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="Admin">Admin Owner</option>
                  <option value="Ad Manager">Ad Campaign Manager</option>
                  <option value="Editor">Content Editor</option>
                  <option value="Viewer">Team Viewer Only</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Profile Status</label>
                <select 
                  className="input-glass select-custom"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="active">Active & Verified</option>
                  <option value="inactive">Archived / Paused</option>
                  <option value="suspended">Restricted / Suspended</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Account Notes / 2FA / Guidelines</label>
              <textarea 
                className="input-glass textarea-custom"
                placeholder="Add 2FA recovery keys, channel descriptions, campaign rules, scheduling notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingSocial ? 'Save Changes' : 'Link Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .social-handles-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .social-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        .social-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .card-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .platform-badge {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 99px;
          border: 1px solid;
          letter-spacing: 0.5px;
        }
        
        .status-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .status-badge.active {
          background: rgba(16, 185, 129, 0.08);
          color: var(--accent-green);
        }
        .status-badge.suspended {
          background: rgba(244, 63, 94, 0.08);
          color: var(--accent-red);
        }
        .status-badge.inactive {
          background: rgba(255,255,255,0.05);
          color: var(--text-secondary);
        }

        .handle-identity h3 {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.3px;
          color: var(--text-primary);
          margin-bottom: 2px;
        }
        .profile-link {
          font-size: 11px;
          color: var(--accent-cyan);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-weight: 500;
        }
        .profile-link:hover {
          text-decoration: underline;
        }

        .team-assignment-box {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-light);
          padding: 10px 14px;
          border-radius: 10px;
          gap: 12px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .info-label {
          font-size: 10px;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
        }
        .info-value {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .social-password-box {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(0,0,0,0.15);
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.03);
        }
        .pwd-col {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .lock-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .social-pass-field {
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 12px;
          font-family: var(--font-mono);
          outline: none;
          width: 130px;
          pointer-events: none;
        }
        .pwd-actions {
          display: flex;
          gap: 4px;
        }

        .social-notes-bubble {
          font-size: 11px;
          background: rgba(168, 85, 247, 0.03);
          border-left: 2px solid var(--accent-purple);
          padding: 8px 12px;
          border-radius: 0 8px 8px 0;
          line-height: 1.4;
          color: var(--text-secondary);
        }
        .social-notes-bubble strong {
          color: var(--text-primary);
          display: block;
          margin-bottom: 2px;
          font-size: 10px;
          text-transform: uppercase;
        }

        .social-card-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 4px;
          border-top: 1px solid var(--border-light);
          padding-top: 16px;
        }
        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }

        .input-prefix-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }
        .input-prefix-at {
          position: absolute;
          left: 14px;
          color: var(--text-muted);
          font-weight: 700;
        }
        .input-with-prefix {
          padding-left: 30px;
        }
      `}</style>
    </div>
  );
};
