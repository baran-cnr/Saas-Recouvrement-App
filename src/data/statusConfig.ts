
import { InvoiceStatus } from '../types';

export interface StatusMeta {
  label: string;
  short: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}

export const STATUS_META: Record<InvoiceStatus, StatusMeta> = {
  paid: {
    label: 'Payé',
    short: 'Payé',
    color: '#15803d',
    bg: '#dcfce7',
    border: '#86efac',
    dot: '🟢',
  },
  pending: {
    label: 'En attente de paiement',
    short: 'En attente',
    color: '#b45309',
    bg: '#fef3c7',
    border: '#fcd34d',
    dot: '🟠',
  },
  litigation: {
    label: 'Contentieux',
    short: 'Contentieux',
    color: '#b91c1c',
    bg: '#fee2e2',
    border: '#fca5a5',
    dot: '🔴',
  },
};

export const STATUS_ORDER: InvoiceStatus[] = ['pending', 'litigation', 'paid'];

export function normalizeStatus(raw: unknown): InvoiceStatus {
  const s = String(raw ?? '').toLowerCase().trim();
  if (!s) return 'pending';
  if (/(pay|réglé|regle|solde|paid|encaiss)/.test(s)) return 'paid';
  if (/(content|litig|recouvr|huissier|proc)/.test(s)) return 'litigation';
  return 'pending';
}
