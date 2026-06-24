
import React, { useEffect, useState } from 'react';
import { getKpis, Kpis } from '../../data/store';
import { formatCurrency, formatNumber } from '../../utils/format';
import InvoiceTable from './InvoiceTable';
import './Dashboard.css';

interface Props {
  refreshToken: number;
  onOpenInvoice: (id: string) => void;
}

function KpiCard({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
  icon: string;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-card__top">
        <span className="kpi-card__label">{label}</span>
        <span className="kpi-card__icon" style={{ background: accent + '22', color: accent }}>
          {icon}
        </span>
      </div>
      <div className="kpi-card__value">{value}</div>
      {hint && <div className="kpi-card__hint">{hint}</div>}
    </div>
  );
}

export default function Dashboard({ refreshToken, onOpenInvoice }: Props) {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    setKpis(getKpis());
  }, [refreshToken]);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Tableau de bord</h1>
          <p className="page__subtitle">
            Pilotez vos encours et vos actions de recouvrement en temps réel.
          </p>
        </div>
      </header>

      <div className="kpi-grid">
        <KpiCard
          label="Encours total à recouvrer"
          value={kpis ? formatCurrency(kpis.totalOutstanding) : '—'}
          hint={kpis ? `${formatNumber(kpis.counts.total)} factures au total` : ''}
          accent="#4f46e5"
          icon="€"
        />
        <KpiCard
          label="Montant en retard"
          value={kpis ? formatCurrency(kpis.overdueAmount) : '—'}
          hint="Factures échues non réglées"
          accent="#dc2626"
          icon="!"
        />
        <KpiCard
          label="Total encaissé"
          value={kpis ? formatCurrency(kpis.totalPaid) : '—'}
          hint="Paiements reçus (partiels inclus)"
          accent="#16a34a"
          icon="✓"
        />
        <KpiCard
          label="Dossiers en contentieux"
          value={kpis ? formatNumber(kpis.counts.litigation) : '—'}
          hint={kpis ? `${formatNumber(kpis.counts.pending)} en attente` : ''}
          accent="#ea580c"
          icon="⚖"
        />
      </div>

      <InvoiceTable refreshToken={refreshToken} onOpenInvoice={onOpenInvoice} />
    </div>
  );
}
