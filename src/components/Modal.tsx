
import React, { useEffect } from 'react';
import './Modal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  headerRight?: React.ReactNode;
}

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  headerRight,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal__overlay" onMouseDown={onClose}>
      <div
        className={`modal modal--${size}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal__header">
          <div>
            {title && <h2 className="modal__title">{title}</h2>}
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <div className="modal__header-right">
            {headerRight}
            <button className="modal__close" onClick={onClose} aria-label="Fermer">
              ✕
            </button>
          </div>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
