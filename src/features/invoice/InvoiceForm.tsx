
import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import {
  listClients,
  createClient,
  createInvoice,
  updateInvoice,
  getInvoice,
} from '../../data/store';
import { InvoiceStatus } from '../../types';
import { STATUS_META, STATUS_ORDER } from '../../data/statusConfig';
import { dateInputValue, parseAmount, todayIso } from '../../utils/format';
import './InvoiceForm.css';

interface Props {
  open: boolean;
  invoiceId: string | null; // null => create
  onClose: () => void;
  onSaved: () => void;
}

export default function InvoiceForm({ open, invoiceId, onClose, onSaved }: Props) {
  const clients = listClients();
  const editing = Boolean(invoiceId);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [clientId, setClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(dateInputValue(todayIso()));
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('pending');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (invoiceId) {
      const inv = getInvoice(invoiceId);
      if (inv) {
        setInvoiceNumber(inv.invoiceNumber);
        setClientMode('existing');
        setClientId(inv.clientId);
        setAmount(String(inv.amount));
        setIssueDate(dateInputValue(inv.issueDate));
        setDueDate(dateInputValue(inv.dueDate));
        setStatus(inv.status);
      }
    } else {
      // Defaults for a fresh invoice: due in 30 days.
      const due = new Date();
      due.setDate(due.getDate() + 30);
      setInvoiceNumber(`FAC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setClientMode(clients.length ? 'existing' : 'new');
      setClientId(clients[0]?.id || '');
      setNewClientName('');
      setNewClientEmail('');
      setAmount('');
      setIssueDate(dateInputValue(todayIso()));
      setDueDate(dateInputValue(due.toISOString()));
      setStatus('pending');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId]);

  const submit = async () => {
    setError('');
    const amt = parseAmount(amount);
    if (!invoiceNumber.trim()) return setError('Le numéro de facture est obligatoire.');
    if (!Number.isFinite(amt) || amt <= 0) return setError('Le montant doit être un nombre positif.');
    if (!dueDate) return setError("La date d'échéance est obligatoire.");
    if (clientMode === 'existing' && !clientId) return setError('Veuillez sélectionner un client.');
    if (clientMode === 'new' && !newClientName.trim())
      return setError('Veuillez renseigner le nom du nouveau client.');

    setSaving(true);
    try {
      if (editing && invoiceId) {
        await updateInvoice(invoiceId, {
          invoiceNumber: invoiceNumber.trim(),
          clientId,
          amount: Math.round(amt * 100) / 100,
          issueDate: new Date(issueDate).toISOString(),
          dueDate: new Date(dueDate).toISOString(),
        });
      } else {
        let cid = clientId;
        if (clientMode === 'new') {
          const c = await createClient({ name: newClientName, email: newClientEmail });
          cid = c.id;
        }
        await createInvoice({
          invoiceNumber: invoiceNumber.trim(),
          clientId: cid,
          amount: Math.round(amt * 100) / 100,
          issueDate: new Date(issueDate).toISOString(),
          dueDate: new Date(dueDate).toISOString(),
          status,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={editing ? 'Modifier la facture' : 'Nouvelle facture'}
      subtitle={
        editing
          ? 'Corrigez les informations ci-dessous (montant, dates, client).'
          : 'Créez une facture manuellement et suivez son recouvrement.'
      }
    >
      <div className="form">
        <div className="form__row">
          <label className="field">
            <span className="field__label">N° de facture *</span>
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Montant TTC (€) *</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </label>
        </div>

        <div className="field">
          <span className="field__label">Client *</span>
          {!editing && (
            <div className="client-toggle">
              <button
                className={clientMode === 'existing' ? 'active' : ''}
                onClick={() => setClientMode('existing')}
                type="button"
              >
                Client existant
              </button>
              <button
                className={clientMode === 'new' ? 'active' : ''}
                onClick={() => setClientMode('new')}
                type="button"
              >
                Nouveau client
              </button>
            </div>
          )}
          {clientMode === 'existing' || editing ? (
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="form__row">
              <input
                placeholder="Nom / Raison sociale"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
              <input
                placeholder="Email (optionnel)"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="form__row">
          <label className="field">
            <span className="field__label">Date d'émission</span>
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Date d'échéance *</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>

        {!editing && (
          <div className="field">
            <span className="field__label">Statut initial</span>
            <div className="status-picker">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`status-opt ${status === s ? 'status-opt--active' : ''}`}
                  style={
                    status === s
                      ? { background: STATUS_META[s].bg, borderColor: STATUS_META[s].border, color: STATUS_META[s].color }
                      : undefined
                  }
                  onClick={() => setStatus(s)}
                >
                  {STATUS_META[s].dot} {STATUS_META[s].short}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="form__error">{error}</div>}

        <div className="form__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer la facture'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
