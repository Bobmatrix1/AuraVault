import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, Unlock, RefreshCw } from 'lucide-react';
import { playSound } from '../utils/audio';

interface VaultLockProps {
  onUnlock: () => void;
}

export const VaultLock: React.FC<VaultLockProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState<string>('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState('ENTER SECURITY KEY');
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');

  // Vault dial rotation angle
  const [dialRotation, setDialRotation] = useState(0);

  // Retrieve password from env or default
  const CORRECT_PIN = import.meta.env.VITE_VAULT_PASSWORD || '2025';

  const handleKeyPress = (num: string) => {
    if (isUnlocking) return;
    if (pin.length >= 8) return;
    
    // Play keypress click sound
    playSound.click();
    
    // Rotate dial on each press
    setDialRotation(prev => prev + 35);
    setPin(prev => prev + num);
    
    if (statusType === 'error') {
      setStatusMessage('ENTER SECURITY KEY');
      setStatusType('info');
    }
  };

  const handleClear = () => {
    if (isUnlocking) return;
    playSound.clear();
    setPin('');
    setDialRotation(prev => prev - 90);
    setStatusMessage('ENTER SECURITY KEY');
    setStatusType('info');
  };

  const handleSubmit = () => {
    if (isUnlocking) return;
    
    if (pin === CORRECT_PIN) {
      setIsUnlocking(true);
      setStatusMessage('ACCESS GRANTED');
      setStatusType('success');
      setDialRotation(prev => prev + 720); // Spin dial rapidly on success

      // Play success chime & pneumatic release rumble swoosh
      playSound.success();
      setTimeout(() => {
        playSound.unlockSwoosh();
      }, 300);

      // Wait for sliding doors animation to complete
      setTimeout(() => {
        onUnlock();
      }, 1600);
    } else {
      playSound.error();
      setIsShaking(true);
      setStatusMessage('ACCESS DENIED');
      setStatusType('error');
      setPin('');
      
      // Shake animation reset
      setTimeout(() => {
        setIsShaking(false);
      }, 600);
    }
  };

  // Allow keyboard entry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isUnlocking) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Escape') {
        handleClear();
      } else if (e.key === 'Enter') {
        handleSubmit();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isUnlocking]);

  return (
    <div className={`vault-lock-screen ${isUnlocking ? 'opening' : ''}`}>
      {/* Split Vault Doors */}
      <div className="vault-door left-door">
        <div className="door-metal-texture"></div>
      </div>
      <div className="vault-door right-door">
        <div className="door-metal-texture"></div>
      </div>

      {/* Lock Core Interface */}
      <div className={`lock-container glass ${isShaking ? 'shake-anim' : ''} ${isUnlocking ? 'fade-out-lock' : ''}`}>
        
        {/* Glowing Dial Column */}
        <div className="dial-section">
          <div className="vault-dial-outer" style={{ transform: `rotate(${dialRotation}deg)` }}>
            <div className="dial-notch notch-0"></div>
            <div className="dial-notch notch-1"></div>
            <div className="dial-notch notch-2"></div>
            <div className="dial-notch notch-3"></div>
            <div className="dial-notch notch-4"></div>
            <div className="dial-notch notch-5"></div>
            <div className="dial-notch notch-6"></div>
            <div className="dial-notch notch-7"></div>
            <div className="vault-dial-inner">
              <div className="dial-center-handle"></div>
            </div>
          </div>
          <div className="dial-sensor-glow"></div>
        </div>

        {/* Keypad & Screen Column */}
        <div className="keypad-section">
          <div className="security-title">
            <ShieldAlert size={18} className="pulse-security" />
            <span>AURAVAULT SECURE STORAGE</span>
          </div>

          <div className={`security-screen status-${statusType}`}>
            <div className="screen-status">{statusMessage}</div>
            <div className="screen-dots">
              {isUnlocking ? (
                <Unlock size={22} className="unlock-icon-spin" />
              ) : pin.length === 0 ? (
                <span className="placeholder-text">ENTER CODE</span>
              ) : (
                '• '.repeat(pin.length)
              )}
            </div>
          </div>

          {/* Keypad Grid */}
          <div className="keypad-grid">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button key={num} type="button" className="keypad-btn" onClick={() => handleKeyPress(num)}>
                {num}
              </button>
            ))}
            <button type="button" className="keypad-btn btn-clear" onClick={handleClear}>
              C
            </button>
            <button type="button" className="keypad-btn" onClick={() => handleKeyPress('0')}>
              0
            </button>
            <button type="button" className="keypad-btn btn-enter" onClick={handleSubmit}>
              ✓
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .vault-lock-screen {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #020308;
          overflow: hidden;
        }

        /* Heavy Steel Vault Doors splitting open */
        .vault-door {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 50%;
          background: radial-gradient(circle at center, #1b2030 0%, #0d0f19 100%);
          border: 1px solid rgba(255, 255, 255, 0.05);
          z-index: 10001;
          box-shadow: inset 0 0 100px rgba(0, 0, 0, 0.8);
          transition: transform 1.2s cubic-bezier(0.77, 0, 0.175, 1);
          overflow: hidden;
          pointer-events: none;
        }
        .left-door {
          left: 0;
          border-right: 4px double rgba(168, 85, 247, 0.3);
          transform: translateX(0);
        }
        .right-door {
          right: 0;
          border-left: 4px double rgba(168, 85, 247, 0.3);
          transform: translateX(0);
        }
        .door-metal-texture {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.01) 0%, transparent 100%);
        }

        .vault-lock-screen.opening .left-door {
          transform: translateX(-100%);
        }
        .vault-lock-screen.opening .right-door {
          transform: translateX(100%);
        }

        /* Lock Container */
        .lock-container {
          display: flex;
          gap: 32px;
          padding: 32px;
          border-radius: 24px;
          z-index: 10002;
          background: rgba(13, 16, 28, 0.85);
          border: 1px solid rgba(168, 85, 247, 0.2);
          box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.15);
          align-items: center;
          transition: transform 0.8s ease, opacity 0.8s ease;
        }
        .fade-out-lock {
          transform: scale(0.8);
          opacity: 0;
          pointer-events: none;
        }
        @media (max-width: 650px) {
          .lock-container {
            flex-direction: column;
            gap: 24px;
            padding: 24px;
          }
        }

        /* Dial lock styling */
        .dial-section {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 200px;
          height: 200px;
        }
        .vault-dial-outer {
          position: relative;
          width: 180px;
          height: 180px;
          border-radius: 50%;
          background: conic-gradient(#2d334d, #141724, #2d334d, #1e2236, #2d334d);
          border: 6px solid #10121e;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(255,255,255,0.05);
          transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
          z-index: 2;
        }
        .vault-dial-inner {
          position: absolute;
          top: 15px; left: 15px; right: 15px; bottom: 15px;
          border-radius: 50%;
          background: radial-gradient(circle, #252a40 0%, #0d0f19 100%);
          border: 3px solid rgba(168, 85, 247, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dial-center-handle {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #1b2030 0%, #10121a 100%);
          border: 4px solid #141624;
          border-radius: 50%;
          box-shadow: 0 4px 8px rgba(0,0,0,0.5);
          position: relative;
        }
        .dial-center-handle::before {
          content: '';
          position: absolute;
          top: 50%; left: 0; right: 0;
          height: 8px;
          background: #141624;
          transform: translateY(-50%);
        }
        .dial-center-handle::after {
          content: '';
          position: absolute;
          left: 50%; top: 0; bottom: 0;
          width: 8px;
          background: #141624;
          transform: translateX(-50%);
        }

        .dial-notch {
          position: absolute;
          background: rgba(255, 255, 255, 0.2);
          width: 2px;
          height: 10px;
          left: calc(50% - 1px);
          top: 4px;
          transform-origin: 50% 86px;
        }
        .notch-0 { transform: rotate(0deg); }
        .notch-1 { transform: rotate(45deg); }
        .notch-2 { transform: rotate(90deg); }
        .notch-3 { transform: rotate(135deg); }
        .notch-4 { transform: rotate(180deg); }
        .notch-5 { transform: rotate(225deg); }
        .notch-6 { transform: rotate(270deg); }
        .notch-7 { transform: rotate(315deg); }

        .dial-sensor-glow {
          position: absolute;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%);
          z-index: 1;
        }

        /* Keypad section */
        .keypad-section {
          width: 260px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .security-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 800;
          color: var(--text-secondary);
          letter-spacing: 0.5px;
        }
        .pulse-security {
          color: var(--accent-purple);
          animation: securityPulse 2s infinite ease-in-out;
        }
        @keyframes securityPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        /* Screen Display */
        .security-screen {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--border-light);
          padding: 12px;
          border-radius: 12px;
          text-align: center;
          min-height: 70px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
        }
        .screen-status {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
        }
        .security-screen.status-info { color: var(--accent-purple); border-color: rgba(168,85,247,0.3); }
        .security-screen.status-error { color: var(--accent-red); border-color: rgba(244,63,94,0.4); animation: shake 0.2s ease-in-out; }
        .security-screen.status-success { color: var(--accent-green); border-color: rgba(16,185,129,0.4); }

        .screen-dots {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 2px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .placeholder-text {
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 1px;
          font-weight: 600;
        }

        /* Keypad grid */
        .keypad-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .keypad-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-light);
          color: var(--text-primary);
          padding: 12px 0;
          font-size: 16px;
          font-weight: 700;
          font-family: var(--font-sans);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .keypad-btn:hover {
          background: rgba(168, 85, 247, 0.1);
          border-color: rgba(168, 85, 247, 0.3);
          color: white;
          transform: scale(1.05);
        }
        .keypad-btn:active {
          transform: scale(0.95);
        }
        .btn-clear {
          color: var(--accent-red);
          border-color: rgba(244, 63, 94, 0.15);
        }
        .btn-clear:hover {
          background: rgba(244, 63, 94, 0.1);
          border-color: rgba(244, 63, 94, 0.3);
        }
        .btn-enter {
          color: var(--accent-green);
          border-color: rgba(16, 185, 129, 0.15);
        }
        .btn-enter:hover {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.3);
        }

        .unlock-icon-spin {
          animation: spin-unlock 0.5s ease-out forwards;
        }
        @keyframes spin-unlock {
          from { transform: scale(0.8) rotate(-45deg); opacity: 0; }
          to { transform: scale(1.1) rotate(0deg); opacity: 1; }
        }

        /* Shake & Error animations */
        .shake-anim {
          animation: lock-shake 0.5s ease-in-out;
        }
        @keyframes lock-shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
};
