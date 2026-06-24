
// Domain model for the receivables / debt-collection application.
// In a production stack these would map 1:1 to PostgreSQL tables managed by
// Prisma/Drizzle. Indexes recommended (see README in store.ts):
//   Invoice(status), Invoice(due_date), Invoice(client_id), Invoice(invoice_number unique)

export type InvoiceStatus = 'paid' | 'pending' | 'litigation';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  amount: number; // total TTC owed
  issueDate: string; // ISO
  dueDate: string; // ISO
  status: InvoiceStatus;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string; // ISO
  note?: string;
}

export type ActivityType =
  | 'created'
  | 'imported'
  | 'status'
  | 'payment'
  | 'edited'
  | 'note';

export interface Activity {
  id: string;
  invoiceId: string;
  type: ActivityType;
  message: string;
  timestamp: string; // ISO
}
