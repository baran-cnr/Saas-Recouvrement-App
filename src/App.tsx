
import React, { useEffect, useState } from 'react';
import './App.css';
import Layout, { View } from './components/Layout';
import Spinner from './components/Spinner';
import Dashboard from './features/dashboard/Dashboard';
import ClientsView from './features/clients/ClientsView';
import ImportWizard from './features/import/ImportWizard';
import InvoiceForm from './features/invoice/InvoiceForm';
import InvoiceDetail from './features/invoice/InvoiceDetail';
import { initDb } from './data/store';

export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('dashboard');
  const [refreshToken, setRefreshToken] = useState(0);

  // Invoice detail (CRM) modal.
  const [detailId, setDetailId] = useState<string | null>(null);
  // Create/edit form modal.
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    initDb().then(() => setReady(true));
  }, []);

  const refresh = () => setRefreshToken((t) => t + 1);

  const openNewInvoice = () => {
    setEditId(null);
    setFormOpen(true);
  };

  const openEdit = (id: string) => {
    setDetailId(null);
    setEditId(id);
    setFormOpen(true);
  };

  if (!ready) {
    return (
      <div className="app-loading">
        <Spinner label="Chargement de Recouvr…" />
      </div>
    );
  }

  return (
    <Layout active={view} onNavigate={setView} onNewInvoice={openNewInvoice}>
      {view === 'dashboard' && (
        <Dashboard refreshToken={refreshToken} onOpenInvoice={setDetailId} />
      )}
      {view === 'clients' && <ClientsView refreshToken={refreshToken} />}
      {view === 'import' && (
        <ImportWizard
          onImported={() => {
            refresh();
          }}
        />
      )}

      {detailId && (
        <InvoiceDetail
          invoiceId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={refresh}
          onEdit={openEdit}
        />
      )}

      <InvoiceForm
        open={formOpen}
        invoiceId={editId}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
      />
    </Layout>
  );
}
