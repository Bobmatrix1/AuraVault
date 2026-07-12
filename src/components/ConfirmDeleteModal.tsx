import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 11000 }}>
      <div 
        className="modal-content glass confirm-delete-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '400px', width: '90%', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="delete-modal-warning-header">
          <div className="warning-icon-bg animate-pulse">
            <AlertTriangle size={24} color="#f43f5e" />
          </div>
          <h3>{title}</h3>
        </div>
        
        <p className="delete-modal-message">{message}</p>
        
        <div className="form-actions" style={{ marginTop: '24px', justifyContent: 'center', gap: '12px' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ flex: 1 }}>
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-danger" 
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            style={{ 
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
              border: 'none',
              color: '#ffffff',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
