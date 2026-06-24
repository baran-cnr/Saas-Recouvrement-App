
import { persistence } from '../utils/persistence';
import {
  Client,
  Invoice,
  Payment,
  Activity,
  ActivityType,
  InvoiceStatus,
} from '../types';
import { seedDatabase } from './seed';
import { normalizeStatus } from './statusConfig';
import { parseAmount, parseDateToIso } from '../utils/format';

/* ============================================================================
 * In-memory data store with persistence.
 *
 * This module emulates the data-access layer of a production backend
 * (PostgreSQL + Prisma/Drizzle). The query engine below mirrors a server-side
 * paginated/filtered/sorted API so the UI can be built exactly as it would
 * against a real REST/GraphQL endpoint.
 *
 * Recommended DB indexes for the equivalent SQL schema:
 *   CREATE INDEX idx_invoice_status   ON invoice(status);
 *   CREATE INDEX idx_invoice_due_date ON invoice(due_date);
 *   CREATE INDEX idx_invoice_client   ON invoice(client_id);
 *   CREATE UNIQUE INDEX idx_invoice_number ON invoice(invoice_number);
 * ========================================================================== */

export interface DBShape {
  clients: Client[];
  invoices: Invoice[];
  payments: Payment[];
  activities: Activity[];
}

export interface EnrichedInvoice extends Invoice {
  clientName: string;
  paid: number;
  balance: number;
  overdueDays: number; // >0 only for unpaid invoices past due date
}

export interface QueryOptions {
  search?: string;
  status?: InvoiceStatus | 'all';
  clientId?: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  dueFrom?: string;
  dueTo?: string;
  onlyOverdue?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface QueryResult {
  rows: EnrichedInvoice[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface Kpis {
  totalOutstanding: number;
  totalPaid: number;
  overdueAmount: number;
  counts: { paid: number; pending: number; litigation: number; total: number };
}

export interface ClientStat {
  client: Client;
  invoiceCount: number;
  outstanding: number;
  total: number;
}

export interface ImportMapping {
  invoiceNumber: string;
  clientName: string;
  amount: string;
  dueDate: string;
  issueDate?: string;
  status?: string;
  email?: string;
}

export interface ImportResult {
  created: number;
  clientsCreated: number;
  failed: number;
  errors: { line: number; message: string }[];
}

const STORAGE_KEY = 'recouvr_db_v2';

let state: DBShape = { clients: [], invoices: [], payments: [], activities: [] };
let loaded = false;

// Derived lookup tables, rebuilt after every mutation (O(n)).
let clientMap = new Map<string, Client>();
let paidMap = new Map<string, number>();

function uid(): string {
  return (crypto as any).randomUUID
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function recompute(): void {
  clientMap = new Map(state.clients.map((c) => [c.id, c]));
  paidMap = new Map();
  for (const p of state.payments) {
    paidMap.set(p.invoiceId, (paidMap.get(p.invoiceId) || 0) + p.amount);
  }
}

async function save(): Promise<void> {
  await persistence.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function initDb(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await persistence.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
    } else {
      state = seedDatabase();
      await save();
    }
  } catch {
    state = seedDatabase();
  }
  recompute();
  loaded = true;
}

export async function resetDb(): Promise<void> {
  state = seedDatabase();
  recompute();
  await save();
}

function enrich(inv: Invoice): EnrichedInvoice {
  const paid = paidMap.get(inv.id) || 0;
  const balance = Math.max(0, Math.round((inv.amount - paid) * 100) / 100);
  let overdueDays = 0;
  if (inv.status !== 'paid' && balance > 0) {
    const diff = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000);
    overdueDays = diff > 0 ? diff : 0;
  }
  return {
    ...inv,
    clientName: clientMap.get(inv.clientId)?.name || 'Client inconnu',
    paid,
    balance,
    overdueDays,
  };
}

function addActivityInternal(
  invoiceId: string,
  type: ActivityType,
  message: string,
  ts?: string
): void {
  state.activities.push({
    id: uid(),
    invoiceId,
    type,
    message,
    timestamp: ts || new Date().toISOString(),
  });
}

/* ----------------------------- Read operations ---------------------------- */

export function listClients(): Client[] {
  return [...state.clients].sort((a, b) => a.name.localeCompare(b.name));
}

export function getClient(id: string): Client | undefined {
  return clientMap.get(id);
}

export function getInvoice(id: string): EnrichedInvoice | null {
  const inv = state.invoices.find((i) => i.id === id);
  return inv ? enrich(inv) : null;
}

export function listPayments(invoiceId: string): Payment[] {
  return state.payments
    .filter((p) => p.invoiceId === invoiceId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export function listActivities(invoiceId: string): Activity[] {
  return state.activities
    .filter((a) => a.invoiceId === invoiceId)
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

export function getKpis(): Kpis {
  let totalOutstanding = 0;
  let totalPaid = 0;
  let overdueAmount = 0;
  const counts = { paid: 0, pending: 0, litigation: 0, total: state.invoices.length };
  for (const inv of state.invoices) {
    const e = enrich(inv);
    totalPaid += e.paid;
    counts[inv.status]++;
    if (inv.status !== 'paid') {
      totalOutstanding += e.balance;
      if (e.overdueDays > 0) overdueAmount += e.balance;
    }
  }
  return {
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    overdueAmount: Math.round(overdueAmount * 100) / 100,
    counts,
  };
}

export function getClientStats(): ClientStat[] {
  const map = new Map<string, ClientStat>();
  for (const c of state.clients) {
    map.set(c.id, { client: c, invoiceCount: 0, outstanding: 0, total: 0 });
  }
  for (const inv of state.invoices) {
    const stat = map.get(inv.clientId);
    if (!stat) continue;
    const e = enrich(inv);
    stat.invoiceCount++;
    stat.total += inv.amount;
    if (inv.status !== 'paid') stat.outstanding += e.balance;
  }
  return [...map.values()].sort((a, b) => b.outstanding - a.outstanding);
}

/**
 * Server-side style query: filter -> sort -> paginate.
 * A small artificial latency is added to faithfully exercise the UI's loading
 * states, exactly as a real network round-trip would.
 */
export async function query(opts: QueryOptions): Promise<QueryResult> {
  await sleep(120);

  const search = (opts.search || '').trim().toLowerCase();
  const status = opts.status || 'all';

  let rows = state.invoices.map(enrich);

  rows = rows.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (opts.clientId && r.clientId !== opts.clientId) return false;
    if (opts.minAmount != null && r.amount < opts.minAmount) return false;
    if (opts.maxAmount != null && r.amount > opts.maxAmount) return false;
    if (opts.dueFrom && r.dueDate < opts.dueFrom) return false;
    if (opts.dueTo && r.dueDate > opts.dueTo + 'T23:59:59.999Z') return false;
    if (opts.onlyOverdue && r.overdueDays <= 0) return false;
    if (search) {
      const hay = `${r.invoiceNumber} ${r.clientName}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const sortBy = opts.sortBy || 'dueDate';
  const dir = opts.sortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    let va: any;
    let vb: any;
    switch (sortBy) {
      case 'clientName':
        va = a.clientName.toLowerCase();
        vb = b.clientName.toLowerCase();
        break;
      case 'amount':
        va = a.amount;
        vb = b.amount;
        break;
      case 'balance':
        va = a.balance;
        vb = b.balance;
        break;
      case 'status':
        va = a.status;
        vb = b.status;
        break;
      case 'issueDate':
        va = a.issueDate;
        vb = b.issueDate;
        break;
      case 'invoiceNumber':
        va = a.invoiceNumber;
        vb = b.invoiceNumber;
        break;
      default:
        va = a.dueDate;
        vb = b.dueDate;
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  const total = rows.length;
  const pageSize = opts.pageSize;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, opts.page), pageCount);
  const start = (page - 1) * pageSize;
  const paged = rows.slice(start, start + pageSize);

  return { rows: paged, total, page, pageSize, pageCount };
}

/* ---------------------------- Write operations ----------------------------- */

export async function createClient(data: {
  name: string;
  email?: string;
  phone?: string;
}): Promise<Client> {
  const client: Client = {
    id: uid(),
    name: data.name.trim(),
    company: data.name.trim(),
    email: data.email?.trim() || '',
    phone: data.phone?.trim() || '',
    createdAt: new Date().toISOString(),
  };
  state.clients.push(client);
  recompute();
  await save();
  return client;
}

export async function createInvoice(data: {
  invoiceNumber: string;
  clientId: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
}): Promise<EnrichedInvoice> {
  const inv: Invoice = {
    id: uid(),
    invoiceNumber: data.invoiceNumber.trim(),
    clientId: data.clientId,
    amount: data.amount,
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    status: data.status,
    createdAt: new Date().toISOString(),
  };
  state.invoices.push(inv);
  const client = clientMap.get(inv.clientId);
  addActivityInternal(
    inv.id,
    'created',
    `Facture ${inv.invoiceNumber} créée manuellement pour ${client?.name || ''}.`
  );
  recompute();
  await save();
  return enrich(inv);
}

export async function updateInvoice(
  id: string,
  data: Partial<Pick<Invoice, 'invoiceNumber' | 'amount' | 'issueDate' | 'dueDate' | 'clientId'>>
): Promise<EnrichedInvoice | null> {
  const inv = state.invoices.find((i) => i.id === id);
  if (!inv) return null;
  const changes: string[] = [];
  if (data.amount != null && data.amount !== inv.amount) {
    changes.push(`montant ${inv.amount} € → ${data.amount} €`);
    inv.amount = data.amount;
  }
  if (data.dueDate && data.dueDate !== inv.dueDate) {
    changes.push(`échéance modifiée`);
    inv.dueDate = data.dueDate;
  }
  if (data.issueDate) inv.issueDate = data.issueDate;
  if (data.invoiceNumber) inv.invoiceNumber = data.invoiceNumber.trim();
  if (data.clientId) inv.clientId = data.clientId;
  if (changes.length) {
    addActivityInternal(inv.id, 'edited', `Facture modifiée : ${changes.join(', ')}.`);
  }
  recompute();
  await save();
  return enrich(inv);
}

export async function deleteInvoice(id: string): Promise<void> {
  state.invoices = state.invoices.filter((i) => i.id !== id);
  state.payments = state.payments.filter((p) => p.invoiceId !== id);
  state.activities = state.activities.filter((a) => a.invoiceId !== id);
  recompute();
  await save();
}

export async function addPayment(
  invoiceId: string,
  amount: number,
  date: string,
  note?: string
): Promise<EnrichedInvoice | null> {
  const inv = state.invoices.find((i) => i.id === invoiceId);
  if (!inv) return null;
  state.payments.push({ id: uid(), invoiceId, amount, date, note });
  addActivityInternal(
    invoiceId,
    'payment',
    `Paiement de ${amount.toLocaleString('fr-FR')} € enregistré${note ? ` (${note})` : ''}.`,
    date
  );
  recompute();

  // Auto-close invoice when fully settled.
  const paid = paidMap.get(invoiceId) || 0;
  if (paid >= inv.amount - 0.005 && inv.status !== 'paid') {
    inv.status = 'paid';
    addActivityInternal(invoiceId, 'status', `Facture soldée — statut passé en « Payé ».`);
  }
  await save();
  return enrich(inv);
}

export async function setStatus(
  invoiceId: string,
  status: InvoiceStatus,
  labelMap: Record<InvoiceStatus, string>
): Promise<EnrichedInvoice | null> {
  const inv = state.invoices.find((i) => i.id === invoiceId);
  if (!inv || inv.status === status) return inv ? enrich(inv) : null;
  inv.status = status;
  addActivityInternal(
    invoiceId,
    'status',
    `Statut passé en « ${labelMap[status]} ».`
  );
  recompute();
  await save();
  return enrich(inv);
}

export async function addNote(invoiceId: string, text: string): Promise<void> {
  addActivityInternal(invoiceId, 'note', text);
  await save();
}

/**
 * Bulk import from a parsed spreadsheet. Processes rows in batches and yields
 * to the event loop between batches so the UI thread (progress bar) stays
 * responsive even for very large files. Clients are de-duplicated by name.
 */
export async function bulkImport(
  rawRows: Record<string, unknown>[],
  mapping: ImportMapping,
  onProgress?: (ratio: number) => void
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, clientsCreated: 0, failed: 0, errors: [] };
  const BATCH = 200;

  const byName = new Map<string, Client>();
  for (const c of state.clients) byName.set(c.name.toLowerCase(), c);

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    try {
      const clientName = String(row[mapping.clientName] ?? '').trim();
      const invoiceNumber = String(row[mapping.invoiceNumber] ?? '').trim();
      const amount = parseAmount(row[mapping.amount]);

      if (!clientName) throw new Error('Nom du client manquant');
      if (!invoiceNumber) throw new Error('Numéro de facture manquant');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Montant invalide');

      const dueIso = parseDateToIso(row[mapping.dueDate]);
      if (!dueIso) throw new Error("Date d'échéance invalide");
      const issueIso =
        (mapping.issueDate && parseDateToIso(row[mapping.issueDate])) || dueIso;
      const status = mapping.status ? normalizeStatus(row[mapping.status]) : 'pending';
      const email = mapping.email ? String(row[mapping.email] ?? '').trim() : '';

      let client = byName.get(clientName.toLowerCase());
      if (!client) {
        client = {
          id: uid(),
          name: clientName,
          company: clientName,
          email,
          phone: '',
          createdAt: new Date().toISOString(),
        };
        state.clients.push(client);
        byName.set(clientName.toLowerCase(), client);
        result.clientsCreated++;
      } else if (email && !client.email) {
        client.email = email;
      }

      const invId = uid();
      state.invoices.push({
        id: invId,
        invoiceNumber,
        clientId: client.id,
        amount: Math.round(amount * 100) / 100,
        issueDate: issueIso,
        dueDate: dueIso,
        status,
        createdAt: new Date().toISOString(),
      });
      addActivityInternal(
        invId,
        'imported',
        `Facture ${invoiceNumber} importée depuis un fichier.`
      );
      result.created++;
    } catch (e) {
      result.failed++;
      if (result.errors.length < 100) {
        result.errors.push({
          line: i + 2, // +1 header row, +1 for 1-based display
          message: e instanceof Error ? e.message : 'Erreur inconnue',
        });
      }
    }

    // Yield to the UI after each batch.
    if (i % BATCH === BATCH - 1) {
      onProgress?.((i + 1) / rawRows.length);
      await sleep(0);
    }
  }

  recompute();
  await save();
  onProgress?.(1);
  return result;
}
