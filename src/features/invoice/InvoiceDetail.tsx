
import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import StatusBadge from '../../components/StatusBadge';
import {
  getInvoice,
  getClient,
  listPayments,
  listActivities,
  addPayment,
  setStatus,
  deleteInvoice,
  EnrichedInvoice,
} from '../../data/store';
import { Activity, InvoiceStatus, Payment } from '../../types';
import { STATUS_META, STATUS_ORDER } from '../../data/statusConfig';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  dateInputValue,
  parseAmount,
  todayIso,
} from '../../utils/format';
import './InvoiceDetail.css';

interface Props {
  invoiceId: string;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (id: string) => void;
}

const ACTIVITY_ICON: Record<Activity['type'], string> = {
  created: '🧾',
  imported: '⬆',
  status: '🔁',
  payment: '💶',
  edited: '✏',
  note: '🗒',
};

const STATUS_LABELS = {
  paid: STATUS_META.paid.label,
  pending: STATUS_META.pending.label,
  litigation: STATUS_META.litigation.label,
} as Record<InvoiceStatus, string>;

export default function InvoiceDetail({ invoiceId, onClose, onChanged, onEdit }: Props) {
  const [inv, setInv] = useState<EnrichedInvoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(dateInputValue(todayIso()));
  const [payNote, setPayNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reload = () => {
    setInv(getInvoice(invoiceId));
    setPayments(listPayments(invoiceId));
    setActivities(listActivities(invoiceId));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const client = useMemo(() => (inv ? getClient(inv.clientId) : undefined), [inv]);

  if (!inv) return null;

  const progress = inv.amount > 0 ? Math.min(100, (inv.paid / inv.amount) * 100) : 0;

  const handlePayment = async () => {
    const amt = parseAmount(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setBusy(true);
    await addPayment(
      invoiceId,
      Math.round(Math.min(amt, inv.balance) * 100) / 100,
      new Date(payDate).toISOString(),
      payNote.trim() || undefined
    );
    setPayAmount('');
    setPayNote('');
    reload();
    onChanged();
    setBusy(false);
  };

  const changeStatus = async (s: InvoiceStatus) => {
    if (s === inv.status) return;
    setBusy(true);
    await setStatus(invoiceId, s, STATUS_LABELS);
    reload();
    onChanged();
    setBusy(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    await deleteInvoice(invoiceId);
    onChanged();
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="detail-title">
          {inv.invoiceNumber} <StatusBadge status={inv.status} full />
        </span>
      }
      subtitle={`${inv.clientName}`}
      headerRight={
        <Button variant="secondary" size="sm" onClick={() => onEdit(invoiceId)} icon={<span>✏</span>}>
          Modifier
        </Button>
      }
    >
      <div className="detail">
        <div className="detail__main">
          {/* Financial summary */}
          <section className="detail-card">
            <div className="summary-grid">
              <div>
                <span className="summary-label">Montant total</span>
                <span className="summary-value">{formatCurrency(inv.amount)}</span>
              </div>
              <div>
                <span className="summary-label">Déjà encaissé</span>
                <span className="summary-value summary-value--green">
                  {formatCurrency(inv.paid)}
                </span>
              </div>
              <div>
                <span className="summary-label">Solde restant dû</span>
                <span className="summary-value summary-value--accent">
                  {formatCurrency(inv.balance)}
                </span>
              </div>
            </div>
            <div className="progress">
              <div className="progress__bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="summary-meta">
              <span>📅 Émise le {formatDate(inv.issueDate)}</span>
              <span>⏳ Échéance le {formatDate(inv.dueDate)}</span>
              {inv.overdueDays > 0 && (
                <span className="meta-overdue">⚠ En retard de {inv.overdueDays} jours</span>
              )}
            </div>
          </section>

          {/* Decision / actions */}
          <section className="detail-card">
            <h3 className="detail-h3">Prise de décision</h3>
            <p className="detail-help">Faites évoluer le statut du dossier de recouvrement.</p>
            <div className="status-actions">
              {STATUS_ORDER.map((s) => {
                const m = STATUS_META[s];
                const active = inv.status === s;
                return (
                  <button
                    key={s}
                    className={`status-action ${active ? 'status-action--active' : ''}`}
                    disabled={busy || active}
                    onClick={() => changeStatus(s)}
                    style={active ? { background: m.bg, borderColor: m.border, color: m.color } : undefined}
                  >
                    <span className="status-action__dot">{m.dot}</span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Payment registration */}
          <section className="detail-card">
            <h3 className="detail-h3">Enregistrer un paiement</h3>
            {inv.balance > 0 ? (
              <>
                <div className="pay-form">
                  <label className="field">
                    <span className="field__label">Montant reçu (€)</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={String(inv.balance)}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Date</span>
                    <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                  </label>
                  <label className="field field--grow">
                    <span className="field__label">Note (optionnel)</span>
                    <input
                      placeholder="Ex: Virement, chèque…"
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                    />
                  </label>
                </div>
                <div className="pay-actions">
                  <button className="quick-fill" onClick={() => setPayAmount(String(inv.balance))}>
                    Solder ({formatCurrency(inv.balance)})
                  </button>
                  <Button onClick={handlePayment} disabled={busy} icon={<span>＋</span>}>
                    Ajouter le paiement
                  </Button>
                </div>
              </>
            ) : (
              <div className="all-paid">✓ Cette facture est intégralement réglée.</div>
            )}

            {payments.length > 0 && (
              <div className="payment-list">
                {payments.map((p) => (
                  <div key={p.id} className="payment-item">
                    <span className="payment-item__amount">{formatCurrency(p.amount)}</span>
                    <span className="payment-item__meta">
                      {formatDate(p.date)}
                      {p.note ? ` · ${p.note}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column: client + timeline */}
        <div className="detail__side">
          <section className="detail-card">
            <h3 className="detail-h3">Client</h3>
            <div className="client-block">
              <div className="client-avatar">
                {inv.clientName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="client-name">{inv.clientName}</div>
                {client?.email && <div className="client-line">✉ {client.email}</div>}
                {client?.phone && <div className="client-line">☎ {client.phone}</div>}
              </div>
            </div>
          </section>

          <section className="detail-card detail-card--timeline">
            <h3 className="detail-h3">Historique du dossier</h3>
            <div className="timeline">
              {activities.map((a) => (
                <div key={a.id} className="timeline-item">
                  <div className="timeline-icon">{ACTIVITY_ICON[a.type]}</div>
                  <div className="timeline-content">
                    <div className="timeline-msg">{a.message}</div>
                    <div className="timeline-time">{formatDateTime(a.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="detail-card detail-card--danger">
            {!confirmDelete ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                🗑 Supprimer cette facture
              </Button>
            ) : (
              <div className="delete-confirm">
                <span>Supprimer définitivement ?</span>
                <div>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Annuler
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleDelete} disabled={busy}>
                    Confirmer
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
}
