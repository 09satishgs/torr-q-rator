import React from 'react';

export default function Toast({ toasts }) {
  if (!toasts || toasts.length === 0) return null;

  const iconMap = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info',
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type || 'info'}`}>
          <i className={`fa-solid ${iconMap[toast.type] || 'fa-bell'}`}></i>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
