import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X
} from 'lucide-react';

export default function ToastNotification({ toasts = [], onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        let Icon = Info;
        let className = 'info';

        if (toast.type === 'success') {
          Icon = CheckCircle2;
          className = 'success';
        } else if (toast.type === 'warning') {
          Icon = AlertTriangle;
          className = 'warning';
        } else if (toast.type === 'danger') {
          Icon = AlertCircle;
          className = 'danger';
        }

        return (
          <div key={toast.id} className={`toast-item ${className}`}>
            <Icon size={18} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, lineHeight: 1.35 }}>{toast.message}</div>
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'currentColor',
                opacity: 0.7,
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
