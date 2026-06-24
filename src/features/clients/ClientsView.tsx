
import React, { useEffect, useState } from 'react';
import { getClientStats, ClientStat } from '../../data/store';
import { formatCurrency, formatNumber } from '../../utils/format';
import './ClientsView.css';

export default function ClientsView({ refreshToken }: { refreshToken: number }) {
  const [stats, setStats] = useState<ClientStat[]>([]);

  useEffect(() => {
    setStats(getClientStats());
  }, [refreshToken]);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Clients</h1>
          <p className="page__subtitle">
            Vue d'ensemble de votre portefeuille et des encours par client.
          </p>
        </div>
      </header>

      <div className="clients-grid">
        {stats.map(({ client, invoiceCount, outstanding, total }) => (
          <div key={client.id} className="client-card">
            <div className="client-card__head">
              <div className="client-card__avatar">
                {client.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="client-card__id">
                <div className="client-card__name">{client.name}</div>
                {client.email && <div className="client-card__email">{client.email}</div>}
              </div>
            </div>
            <div className="client-card__stats">
              <div>
                <span className="cc-label">Factures</span>
                <span className="cc-value">{formatNumber(invoiceCount)}</span>
              </div>
              <div>
                <span className="cc-label">Facturé</span>
                <span className="cc-value">{formatCurrency(total)}</span>
              </div>
              <div>
                <span className="cc-label">Encours dû</span>
                <span className={`cc-value ${outstanding > 0 ? 'cc-value--due' : 'cc-value--ok'}`}>
                  {formatCurrency(outstanding)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
