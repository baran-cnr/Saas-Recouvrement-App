
import React from 'react';
import './Button.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'subtle';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  block?: boolean;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  block,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${block ? 'btn--block' : ''} ${className}`}
      {...rest}
    >
      {icon && <span className="btn__icon">{icon}</span>}
      {children}
    </button>
  );
}
