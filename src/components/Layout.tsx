
import React from 'react';
import Button from './Button';
import './Layout.css';

export type View = 'dashboard' | 'clients' | 'import';

interface Props {
  active: View;
  onNavigate: (v: View) => void;
  onNewInvoice: () => void;
  children: React.ReactNode;
}

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '▦' },
  { id: 'clients', label: 'Clients', icon: '👥' },
  { id: 'import', label: 'Importer', icon: '⬆' },
];

export default function Layout({ active, onNavigate, onNewInvoice, children }: Props) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__logo">R</div>
          <div>
            <div className="sidebar__name">Recouvr</div>
            <div className="sidebar__tag">Gestion de créances</div>
          </div>
        </div>

        <div className="sidebar__cta">
          <Button block onClick={onNewInvoice} icon={<span>＋</span>}>
            Nouvelle facture
          </Button>
        </div>

        <nav className="sidebar__nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${active === item.id ? 'nav-item--active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-item__icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">JD</div>
            <div>
              <div className="sidebar__user-name">Jean Dubois</div>
              <div className="sidebar__user-role">Responsable comptable</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="layout__main">{children}</main>
    </div>
  );
}
