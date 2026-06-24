
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  query,
  listClients,
  QueryResult,
  EnrichedInvoice,
} from '../../data/store';
import { InvoiceStatus } from '../../types';
import { STATUS_META } from '../../data/statusConfig';
import { formatCurrency, formatDate, parseAmount } from '../../utils/format';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import './InvoiceTable.css';

interface Props {
  refreshToken: number;
  onOpenInvoice: (id: string) => void;
}

type SortKey = 'invoiceNumber' | 'clientName' | 'amount' | 'balance' | 'dueDate' | 'status';

const PAGE_SIZES = [10, 25, 50, 100];

export default function InvoiceTable({ refreshToken, onOpenInvoice }: Props) {
  const clients = useMemo(() => listClients(), [refreshToken]);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all');
  const [clientId, setClientId] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const [sortBy, setSortBy] = useState<SortKey>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showFilters, setShowFilters] = useState(false);

  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const reqId = useRef(0);

  // Debounce free-text search.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 280);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch a page whenever any query parameter changes (server-side style).
  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    query({
      search,
      status,
      clientId: clientId || undefined,
      minAmount: minAmount ? parseAmount(minAmount) : null,
      maxAmount: maxAmount ? parseAmount(maxAmount) : null,
      dueFrom: dueFrom || undefined,
      dueTo: dueTo || undefined,
      onlyOverdue,
      sortBy,
      sortDir,
      page,
      pageSize,
    }).then((res) => {
      // Ignore out-of-order responses.
      if (id === reqId.current) {
        setResult(res);
        setLoading(false);
      }
    });
  }, [
    search, status, clientId, minAmount, maxAmount, dueFrom, dueTo, onlyOverdue,
    sortBy, sortDir, page, pageSize, refreshToken,
  ]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const sortArrow = (key: SortKey) =>
    sortBy === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const resetFilters = () => {
    setSearchInput('');
    setStatus('all');
    setClientId('');
    setMinAmount('');
    setMaxAmount('');
    setDueFrom('');
    setDueTo('');
    setOnlyOverdue(false);
    setPage(1);
  };

  const activeFilterCount =
    (status !== 'all' ? 1 : 0) +
    (clientId ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0) +
    (dueFrom ? 1 : 0) +
    (dueTo ? 1 : 0) +
    (onlyOverdue ? 1 : 0);

  const total = result?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="grid-card">
      <div className="grid-toolbar">
        <div className="grid-search">
          <span className="grid-search__icon">⌕</span>
          <input
            placeholder="Rechercher une facture ou un client…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="grid-status-tabs">
          {(['all', 'pending', 'litigation', 'paid'] as const).map((s) => (
            <button
              key={s}
              className={`status-tab ${status === s ? 'status-tab--active' : ''}`}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {s === 'all' ? 'Toutes' : STATUS_META[s].short}
            </button>
          ))}
        </div>

        <Button
          variant={activeFilterCount ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setShowFilters((v) => !v)}
          icon={<span>⚙</span>}
        >
          Filtres{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </Button>
      </div>

      {showFilters && (
        <div className="grid-filters">
          <label className="filter">
            <span>Client</span>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tous les clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter">
            <span>Montant min (€)</span>
            <input
              type="number"
              value={minAmount}
              onChange={(e) => {
                setMinAmount(e.target.value);
                setPage(1);
              }}
              placeholder="0"
            />
          </label>
          <label className="filter">
            <span>Montant max (€)</span>
            <input
              type="number"
              value={maxAmount}
              onChange={(e) => {
                setMaxAmount(e.target.value);
                setPage(1);
              }}
              placeholder="∞"
            />
          </label>
          <label className="filter">
            <span>Échéance après</span>
            <input
              type="date"
              value={dueFrom}
              onChange={(e) => {
                setDueFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="filter">
            <span>Échéance avant</span>
            <input
              type="date"
              value={dueTo}
              onChange={(e) => {
                setDueTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="filter filter--check">
            <input
              type="checkbox"
              checked={onlyOverdue}
              onChange={(e) => {
                setOnlyOverdue(e.target.checked);
                setPage(1);
              }}
            />
            <span>Uniquement en retard</span>
          </label>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Réinitialiser
          </Button>
        </div>
      )}

      <div className="grid-scroll">
        <table className="grid-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('invoiceNumber')} className="th-sort">
                N° Facture{sortArrow('invoiceNumber')}
              </th>
              <th onClick={() => toggleSort('clientName')} className="th-sort">
                Client{sortArrow('clientName')}
              </th>
              <th onClick={() => toggleSort('amount')} className="th-sort th-right">
                Montant{sortArrow('amount')}
              </th>
              <th onClick={() => toggleSort('balance')} className="th-sort th-right">
                Solde dû{sortArrow('balance')}
              </th>
              <th onClick={() => toggleSort('dueDate')} className="th-sort">
                Échéance{sortArrow('dueDate')}
              </th>
              <th onClick={() => toggleSort('status')} className="th-sort">
                Statut{sortArrow('status')}
              </th>
            </tr>
          </thead>
          <tbody className={loading ? 'is-loading' : ''}>
            {result?.rows.map((inv: EnrichedInvoice) => (
              <tr key={inv.id} onClick={() => onOpenInvoice(inv.id)}>
                <td className="cell-mono">{inv.invoiceNumber}</td>
                <td className="cell-client">{inv.clientName}</td>
                <td className="th-right cell-amount">{formatCurrency(inv.amount)}</td>
                <td className="th-right cell-balance">
                  {inv.balance > 0 ? formatCurrency(inv.balance) : '—'}
                </td>
                <td>
                  <div className="cell-due">
                    <span>{formatDate(inv.dueDate)}</span>
                    {inv.overdueDays > 0 && (
                      <span className="overdue-pill">+{inv.overdueDays}j</span>
                    )}
                  </div>
                </td>
                <td>
                  <StatusBadge status={inv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="grid-overlay">
            <div className="spinner" />
          </div>
        )}

        {!loading && result && result.rows.length === 0 && (
          <div className="grid-empty">
            <div className="grid-empty__icon">🗂️</div>
            <p>Aucune facture ne correspond à vos critères.</p>
            {activeFilterCount > 0 && (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid-footer">
        <div className="grid-footer__info">
          {total > 0 ? (
            <>
              <strong>{from}–{to}</strong> sur <strong>{total}</strong> factures
            </>
          ) : (
            'Aucun résultat'
          )}
        </div>
        <div className="grid-footer__controls">
          <label className="page-size">
            Lignes :
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="pager">
            <button disabled={page <= 1} onClick={() => setPage(1)}>«</button>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span className="pager__label">
              Page {result?.page ?? 1} / {result?.pageCount ?? 1}
            </span>
            <button
              disabled={!result || page >= result.pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </button>
            <button
              disabled={!result || page >= result.pageCount}
              onClick={() => result && setPage(result.pageCount)}
            >
              »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
