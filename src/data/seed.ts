
import type { DBShape } from './store';
import { Client, Invoice, Activity, Payment, InvoiceStatus } from '../types';

// Generates a realistic demo dataset on first launch so the dashboard is never
// empty. Replaced as soon as the user imports/creates real data.

const COMPANIES = [
  'Dupont & Associés', 'Boulangerie Lemaire', 'TechNova SAS', 'Garage Moderne',
  'Cabinet Ferreira', 'Atelier du Bois', 'Distribution Martin', 'Pharmacie du Centre',
  'Imprimerie Royale', 'Studio Lumière', 'BTP Concept', 'Maraîcher Bio Vallée',
  'Optique Vision Plus', 'Transports Girard', 'Hôtel Belle Vue', 'Clinique Vétérinaire Soleil',
  'Menuiserie Petit', 'Agence Web Pixel', 'Fromagerie Comté Or', 'Électricité Générale Rey',
];

const FIRST = ['contact', 'compta', 'direction', 'achats', 'admin'];

function uid(): string {
  return (crypto as any).randomUUID
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function rnd(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function seedDatabase(): DBShape {
  const clients: Client[] = [];
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const activities: Activity[] = [];

  const now = Date.now();

  COMPANIES.forEach((name, i) => {
    const slug = name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
    clients.push({
      id: uid(),
      name,
      company: name,
      email: `${pick(FIRST)}@${slug || 'client'}.fr`,
      phone: `0${Math.floor(rnd(1, 7))} ${Math.floor(rnd(10, 99))} ${Math.floor(
        rnd(10, 99)
      )} ${Math.floor(rnd(10, 99))} ${Math.floor(rnd(10, 99))}`,
      createdAt: new Date(now - rnd(180, 600) * 86400000).toISOString(),
    });
  });

  let counter = 1042;
  for (let i = 0; i < 74; i++) {
    const client = pick(clients);
    const issue = new Date(now - rnd(2, 200) * 86400000);
    const term = pick([30, 45, 60]);
    const due = new Date(issue.getTime() + term * 86400000);
    const amount = Math.round(rnd(180, 16000) * 100) / 100;
    const invId = uid();

    // Weighted status distribution.
    const r = Math.random();
    let status: InvoiceStatus;
    if (r < 0.42) status = 'paid';
    else if (r < 0.82) status = 'pending';
    else status = 'litigation';

    const invoiceNumber = `FAC-2025-${counter++}`;

    invoices.push({
      id: invId,
      invoiceNumber,
      clientId: client.id,
      amount,
      issueDate: issue.toISOString(),
      dueDate: due.toISOString(),
      status,
      createdAt: issue.toISOString(),
    });

    activities.push({
      id: uid(),
      invoiceId: invId,
      type: 'created',
      message: `Facture ${invoiceNumber} créée pour ${client.name}.`,
      timestamp: issue.toISOString(),
    });

    if (status === 'paid') {
      const payDate = new Date(issue.getTime() + rnd(5, term) * 86400000);
      payments.push({
        id: uid(),
        invoiceId: invId,
        amount,
        date: payDate.toISOString(),
        note: 'Paiement intégral',
      });
      activities.push({
        id: uid(),
        invoiceId: invId,
        type: 'payment',
        message: `Paiement intégral reçu.`,
        timestamp: payDate.toISOString(),
      });
    } else if (Math.random() < 0.35) {
      // Partial payment on some open invoices.
      const part = Math.round(amount * rnd(0.2, 0.6) * 100) / 100;
      const payDate = new Date(issue.getTime() + rnd(5, term) * 86400000);
      payments.push({
        id: uid(),
        invoiceId: invId,
        amount: part,
        date: payDate.toISOString(),
        note: 'Acompte',
      });
      activities.push({
        id: uid(),
        invoiceId: invId,
        type: 'payment',
        message: `Paiement partiel reçu.`,
        timestamp: payDate.toISOString(),
      });
    }

    if (status === 'litigation') {
      const escDate = new Date(due.getTime() + rnd(10, 40) * 86400000);
      activities.push({
        id: uid(),
        invoiceId: invId,
        type: 'status',
        message: `Statut passé en « Contentieux » — procédure de recouvrement engagée.`,
        timestamp: escDate.toISOString(),
      });
    }
  }

  return { clients, invoices, payments, activities };
}
