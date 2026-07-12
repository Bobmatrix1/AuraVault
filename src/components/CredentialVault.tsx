import React, { useState } from 'react';
import { 
  Key, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  ExternalLink,
  Lock,
  Globe,
  Database,
  Server,
  DollarSign,
  MoreHorizontal
} from 'lucide-react';
import { playSound } from '../utils/audio';
import { VaultCredential } from '../utils/db';

interface CredentialVaultProps {
  credentials: VaultCredential[];
  onAddCredential: (cred: Omit<VaultCredential, 'id' | 'updatedAt'>) => Promise<void>;
  onEditCredential: (id: string, cred: Partial<VaultCredential>) => Promise<void>;
  onDeleteCredential: (id: string) => Promise<void>;
  toast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  showAddModalDirectly?: boolean;
  onCloseAddModalDirectly?: () => void;
}

export const CredentialVault: React.FC<CredentialVaultProps> = ({
  credentials,
  onAddCredential,
  onEditCredential,
  onDeleteCredential,
  toast,
  showAddModalDirectly = false,
  onCloseAddModalDirectly
}) => {
  // Navigation / Filter State
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // UI States
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'user' | 'pass' | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  
  // Modal / Form State
  const [showAddModal, setShowAddModal] = useState(showAddModalDirectly);
  const [editingCred, setEditingCred] = useState<VaultCredential | null>(null);
  
  // Form Inputs
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState('social');
  const [website, setWebsite] = useState('');
  const [note, setNote] = useState('');
  
  // Password Generator State
  const [genLength, setGenLength] = useState(14);
  const [genIncludeUppercase, setGenIncludeUppercase] = useState(true);
  const [genIncludeNumbers, setGenIncludeNumbers] = useState(true);
  const [genIncludeSymbols, setGenIncludeSymbols] = useState(true);

  // Sync state if parent props change modal visibility
  React.useEffect(() => {
    if (showAddModalDirectly) {
      setShowAddModal(true);
    }
  }, [showAddModalDirectly]);

  // Categories
  const categories = [
    { id: 'all', label: 'All Passwords', icon: Key },
    { id: 'social', label: 'Socials', icon: Share2IconMock }, // Use Custom inline or mock since Share2 is social
    { id: 'server', label: 'Servers', icon: Server },
    { id: 'database', label: 'Databases', icon: Database },
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'other', label: 'Other', icon: Lock },
  ];

  function Share2IconMock(props: any) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    );
  }

  // Filter credentials
  const filteredCreds = credentials.filter(cred => {
    const matchesCategory = activeCategory === 'all' || cred.category === activeCategory;
    const matchesSearch = 
      cred.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cred.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cred.website && cred.website.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (cred.note && cred.note.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Toggle Password Visiblity
  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, id: string, type: 'user' | 'pass') => {
    playSound.copy();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setCopiedType(type);
    toast(`${type === 'user' ? 'Username' : 'Password'} copied to clipboard`, 'success');
    setTimeout(() => {
      setCopiedId(null);
      setCopiedType(null);
    }, 2000);
  };

  // Evaluate Password Strength (0-4 scale)
  const calculateStrength = (pwd: string): number => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return Math.min(score, 4);
  };

  const getStrengthLabel = (score: number) => {
    switch (score) {
      case 0: return { label: 'Too Weak', color: 'var(--accent-red)' };
      case 1: return { label: 'Weak', color: 'var(--accent-red)' };
      case 2: return { label: 'Fair', color: 'var(--accent-amber)' };
      case 3: return { label: 'Good', color: 'var(--accent-cyan)' };
      case 4: return { label: 'Strong', color: 'var(--accent-green)' };
      default: return { label: 'Weak', color: 'var(--accent-red)' };
    }
  };

  // Password Generator
  const generatePassword = () => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
    
    let chars = lowercase;
    if (genIncludeUppercase) chars += uppercase;
    if (genIncludeNumbers) chars += numbers;
    if (genIncludeSymbols) chars += symbols;
    
    let generated = '';
    for (let i = 0; i < genLength; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      generated += chars[randomIndex];
    }
    
    setPassword(generated);
    toast('Generated strong password', 'info');
  };

  // Open Modal to Add
  const openAddModal = () => {
    setEditingCred(null);
    setName('');
    setUsername('');
    setPassword('');
    setCategory('social');
    setWebsite('');
    setNote('');
    setShowAddModal(true);
  };

  // Open Modal to Edit
  const openEditModal = (cred: VaultCredential) => {
    setEditingCred(cred);
    setName(cred.name);
    setUsername(cred.username);
    setPassword(cred.password);
    setCategory(cred.category);
    setWebsite(cred.website || '');
    setNote(cred.note || '');
    setShowAddModal(true);
  };

  // Close Modal
  const closeModal = () => {
    setShowAddModal(false);
    setEditingCred(null);
    if (onCloseAddModalDirectly) {
      onCloseAddModalDirectly();
    }
  };

  // Handle Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password.trim()) {
      toast('Please fill all required fields', 'error');
      return;
    }

    const strength = calculateStrength(password);

    try {
      if (editingCred) {
        await onEditCredential(editingCred.id, {
          name: name.trim(),
          username: username.trim(),
          password,
          category,
          website: website.trim() || undefined,
          note: note.trim() || undefined,
          strength,
          updatedAt: Date.now()
        });
        toast(`Credential "${name}" updated`, 'success');
      } else {
        await onAddCredential({
          name: name.trim(),
          username: username.trim(),
          password,
          category,
          website: website.trim() || undefined,
          note: note.trim() || undefined,
          strength
        });
        toast(`Credential "${name}" saved`, 'success');
      }
      closeModal();
    } catch (err) {
      toast('Failed to save credential', 'error');
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'social':
        return <Share2IconMock size={16} />;
      case 'server':
        return <Server size={16} />;
      case 'database':
        return <Database size={16} />;
      case 'financial':
        return <DollarSign size={16} />;
      default:
        return <Lock size={16} />;
    }
  };

  return (
    <div className="credential-vault-view">
      {/* Top Header */}
      <div className="header-row">
        <div className="page-title">
          <h2>Credentials Vault</h2>
          <p>Secure management of database connections, API tokens, and admin portals.</p>
        </div>

        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} />
          <span>Add Credential</span>
        </button>
      </div>

      {/* Categories & Search Panel */}
      <div className="vault-filter-panel glass">
        <div className="category-scroll-container">
          {categories.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                className={`category-pill ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="search-box-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search credentials..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-glass search-input"
          />
        </div>
      </div>

      {/* Credentials Listing */}
      {filteredCreds.length === 0 ? (
        <div className="empty-state glass">
          <Lock size={48} className="empty-icon animate-pulse" />
          <h3>No credentials found</h3>
          <p>Keep your databases and servers secure by keeping passwords in our encrypted local vault.</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAddModal}>
            Create Credential
          </button>
        </div>
      ) : (
        <div className="credentials-grid">
          {filteredCreds.map(cred => {
            const isPasswordVisible = visiblePasswords[cred.id] || false;
            const strengthData = getStrengthLabel(cred.strength);

            return (
              <div key={cred.id} className="credential-card glass glass-hover">
                <div className="card-top-header">
                  <div className="cred-category-badge" title={`Category: ${cred.category}`}>
                    {getCategoryIcon(cred.category)}
                    <span>{cred.category}</span>
                  </div>
                  <div className="card-options">
                    <button className="card-opt-btn" onClick={() => openEditModal(cred)} title="Edit">
                      <Edit3 size={13} />
                    </button>
                    <button 
                      className="card-opt-btn delete" 
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete credential "${cred.name}"?`)) {
                          onDeleteCredential(cred.id);
                          toast(`Deleted "${cred.name}"`, 'info');
                        }
                      }}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <h3 className="cred-name">{cred.name}</h3>

                {cred.website && (
                  <a 
                    href={cred.website.startsWith('http') ? cred.website : `https://${cred.website}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="cred-website-link"
                  >
                    <span>{cred.website}</span>
                    <ExternalLink size={10} />
                  </a>
                )}

                <div className="cred-details-container">
                  {/* Username Display */}
                  <div className="cred-detail-row">
                    <div className="label-col">Username</div>
                    <div className="value-col font-mono">
                      <span>{cred.username}</span>
                      <button 
                        className="copy-field-btn"
                        onClick={() => handleCopy(cred.username, cred.id, 'user')}
                        title="Copy Username"
                      >
                        {copiedId === cred.id && copiedType === 'user' ? (
                          <Check size={12} color="var(--accent-green)" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Password Display */}
                  <div className="cred-detail-row">
                    <div className="label-col">Password</div>
                    <div className="value-col font-mono">
                      <input 
                        type={isPasswordVisible ? 'text' : 'password'}
                        value={cred.password}
                        readOnly
                        className="card-password-field"
                      />
                      <div className="action-buttons-group">
                        <button 
                          className="copy-field-btn" 
                          onClick={() => togglePasswordVisibility(cred.id)}
                          title={isPasswordVisible ? 'Hide Password' : 'Show Password'}
                        >
                          {isPasswordVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button 
                          className="copy-field-btn"
                          onClick={() => handleCopy(cred.password, cred.id, 'pass')}
                          title="Copy Password"
                        >
                          {copiedId === cred.id && copiedType === 'pass' ? (
                            <Check size={12} color="var(--accent-green)" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Strength Meter & Notes */}
                <div className="card-footer-metrics">
                  <div className="strength-bar-indicator">
                    <div className="strength-label-text">Strength:</div>
                    <div className="strength-bar-track">
                      <div 
                        className="strength-bar-fill" 
                        style={{ 
                          width: `${(cred.strength / 4) * 100}%`,
                          backgroundColor: strengthData.color 
                        }} 
                      />
                    </div>
                    <span className="strength-text-label" style={{ color: strengthData.color }}>
                      {strengthData.label}
                    </span>
                  </div>

                  {cred.note && (
                    <div className="cred-card-notes" title={cred.note}>
                      {cred.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Credential Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <form className="modal-content glass add-cred-modal-layout" onClick={(e) => e.stopPropagation()} onSubmit={handleFormSubmit}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingCred ? `Modify: ${editingCred.name}` : 'Vault New Credential'}
              </h3>
              <button type="button" className="close-btn" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-body-split">
              {/* Form Input fields */}
              <div className="form-fields-section">
                <div className="form-group">
                  <label className="form-label">Service / Name *</label>
                  <input 
                    type="text" 
                    className="input-glass"
                    placeholder="e.g. AWS Production Database, Slack Admin"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select 
                      className="input-glass select-custom"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="social">Socials</option>
                      <option value="server">Servers</option>
                      <option value="database">Databases</option>
                      <option value="financial">Financial</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Website / IP</label>
                    <input 
                      type="text" 
                      className="input-glass"
                      placeholder="e.g. aws.amazon.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Username / Key Identifier *</label>
                  <input 
                    type="text" 
                    className="input-glass"
                    placeholder="e.g. admin@company.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <div className="input-with-button-wrapper">
                    <input 
                      type="text" 
                      className="input-glass font-mono"
                      placeholder="Type or generate a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <div className="input-meter-float" style={{ color: getStrengthLabel(calculateStrength(password)).color }}>
                      {getStrengthLabel(calculateStrength(password)).label}
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Secure Notes</label>
                  <textarea 
                    className="input-glass textarea-custom"
                    placeholder="Database ports, recovery phrases, API endpoints..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* Password Generator Sidebar */}
              <div className="generator-panel glass">
                <h4>Password Generator</h4>
                
                <div className="gen-setting">
                  <label className="form-label">Length: {genLength}</label>
                  <input 
                    type="range" 
                    min="8" 
                    max="32" 
                    value={genLength} 
                    onChange={(e) => setGenLength(parseInt(e.target.value))}
                    className="range-input"
                  />
                </div>

                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={genIncludeUppercase} 
                    onChange={(e) => setGenIncludeUppercase(e.target.checked)}
                  />
                  <span>Include Uppercase (A-Z)</span>
                </label>

                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={genIncludeNumbers} 
                    onChange={(e) => setGenIncludeNumbers(e.target.checked)}
                  />
                  <span>Include Numbers (0-9)</span>
                </label>

                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={genIncludeSymbols} 
                    onChange={(e) => setGenIncludeSymbols(e.target.checked)}
                  />
                  <span>Include Symbols (#@$%)</span>
                </label>

                <button 
                  type="button" 
                  className="btn btn-secondary btn-full"
                  onClick={generatePassword}
                >
                  Generate Strong
                </button>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingCred ? 'Apply Changes' : 'Save Securely'}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .credential-vault-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .vault-filter-panel {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          gap: 16px;
        }
        .category-scroll-container {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .category-pill {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-light);
          color: var(--text-secondary);
          padding: 8px 14px;
          border-radius: 99px;
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .category-pill:hover {
          background: rgba(255,255,255,0.05);
          color: var(--text-primary);
        }
        .category-pill.active {
          background: rgba(168, 85, 247, 0.15);
          border-color: rgba(168, 85, 247, 0.3);
          color: var(--text-primary);
        }
        
        /* Grid */
        .credentials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .credential-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .card-top-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .cred-category-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--accent-purple);
          background: rgba(168, 85, 247, 0.08);
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid rgba(168, 85, 247, 0.15);
        }
        .card-options {
          display: flex;
          gap: 4px;
        }
        .card-opt-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          transition: all 0.15s;
        }
        .card-opt-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.05);
        }
        .card-opt-btn.delete:hover {
          color: var(--accent-red);
          background: rgba(244, 63, 94, 0.15);
        }
        .cred-name {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.2px;
          margin-bottom: 4px;
          color: var(--text-primary);
        }
        .cred-website-link {
          font-size: 11px;
          color: var(--accent-cyan);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 16px;
          font-weight: 500;
          align-self: flex-start;
        }
        .cred-website-link:hover {
          text-decoration: underline;
        }
        
        .cred-details-container {
          background: rgba(0,0,0,0.15);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .cred-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }
        .label-col {
          color: var(--text-muted);
          font-weight: 600;
        }
        .value-col {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-primary);
        }
        .copy-field-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.15s;
          display: flex;
          align-items: center;
        }
        .copy-field-btn:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.05);
        }
        .card-password-field {
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-size: 12px;
          text-align: right;
          width: 100px;
          outline: none;
          pointer-events: none;
        }
        .action-buttons-group {
          display: flex;
          gap: 2px;
        }
        
        .card-footer-metrics {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .strength-bar-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
        }
        .strength-label-text {
          color: var(--text-muted);
          font-weight: 600;
        }
        .strength-bar-track {
          flex-grow: 1;
          height: 4px;
          background: rgba(255,255,255,0.05);
          border-radius: 99px;
          overflow: hidden;
        }
        .strength-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.3s ease;
        }
        .strength-text-label {
          font-weight: 700;
          font-size: 10px;
          text-transform: uppercase;
        }
        .cred-card-notes {
          font-size: 11px;
          color: var(--text-secondary);
          background: rgba(255,255,255,0.02);
          border-left: 2px solid var(--border-light);
          padding: 6px 10px;
          border-radius: 0 4px 4px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Modal Layout */
        .add-cred-modal-layout {
          max-width: 800px;
        }
        .modal-body-split {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 24px;
          margin-bottom: 8px;
        }
        @media (max-width: 768px) {
          .modal-body-split {
            grid-template-columns: 1fr;
          }
        }
        .form-row-2 {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 16px;
        }
        .select-custom {
          padding: 11px 16px;
          color-scheme: dark;
          cursor: pointer;
        }
        .textarea-custom {
          resize: none;
        }
        .input-with-button-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-meter-float {
          position: absolute;
          right: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        
        /* Generator Panel */
        .generator-panel {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-self: flex-start;
          width: 100%;
        }
        .generator-panel h4 {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 4px;
          color: var(--accent-purple);
          border-bottom: 1px solid var(--border-light);
          padding-bottom: 8px;
        }
        .gen-setting {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .range-input {
          width: 100%;
          accent-color: var(--accent-purple);
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: var(--text-secondary);
          cursor: pointer;
          user-select: none;
        }
        .checkbox-label input {
          accent-color: var(--accent-purple);
        }
        .btn-full {
          width: 100%;
          margin-top: 8px;
        }
        @media (max-width: 768px) {
          .credentials-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
