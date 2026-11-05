import { apiFetch } from '../lib/apiClient';

export type TicketStatus = 'OPEN' | 'ANSWERED' | 'RESOLVED' | 'CLOSED';
export type TicketCategory = 'ESIM' | 'PAYMENT' | 'REFUND' | 'OTHER';

// Matches serialize_ticket() in app/services/support_svc.py (list form, no
// messages/for_staff fields).
export type Ticket = {
  id: string;
  reference: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  order_id: string | null;
  created_at: string;
  last_message_at: string;
  resolved_at: string | null;
  closed_at: string | null;
};

// Authenticated.
export function getMyTickets(token: string): Promise<Ticket[]> {
  return apiFetch<Ticket[]>('/support/tickets', { token });
}
