
import React from 'react';
import { InvoiceStatus } from '../types';
import { STATUS_META } from '../data/statusConfig';
import './StatusBadge.css';

export default function StatusBadge({
  status,
  full = false,
}: {
  status: InvoiceStatus;
  full?: boolean;
}) {
  const m = STATUS_META[status];
  return (
    <span
      className="status-badge"
      style={{ background: m.bg, color: m.color, borderColor: m.border }}
    >
      <span className="status-badge__dot" style={{ background: m.color }} />
      {full ? m.label : m.short}
    </span>
  );
}
