import { apiFetch, apiFetchForm } from '../lib/apiClient';

export type TicketStatus = 'OPEN' | 'ANSWERED' | 'RESOLVED' | 'CLOSED';
export type TicketCategory = 'ESIM' | 'PAYMENT' | 'REFUND' | 'ACCOUNT' | 'PARTNER' | 'OTHER';

export type TicketCategoryOption = { value: TicketCategory; label: string };

export type TicketAttachment = {
  id: string;
  name: string;
  content_type: string;
  size_bytes: number;
  // Fetched through the authenticated /support/attachments/{id} endpoint,
  // never a static path - see app/api/v1/support.py's module docstring.
  url: string;
};

export type TicketMessage = {
  id: string;
  body: string;
  is_staff: boolean;
  author: string;
  created_at: string;
  attachments: TicketAttachment[];
};

export type TicketDetail = Ticket & { messages: TicketMessage[] };

// A file picked on-device (expo-image-picker's asset shape, narrowed to
// what the multipart upload needs) - not a web File, RN's fetch/FormData
// wants { uri, name, type }.
export type NewTicketFile = { uri: string; name: string; type: string };

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

// Public - so the form's category options and the backend's enum can't
// drift apart (app/api/v1/support.py's list_categories()).
export function getCategories(): Promise<TicketCategoryOption[]> {
  return apiFetch<TicketCategoryOption[]>('/support/categories');
}

// Authenticated. FR-1102 - multipart since attachments ride along; see
// apiFetchForm's note on why this can't go through apiFetch.
export function createTicket(
  token: string,
  params: { subject: string; body: string; category: TicketCategory; files: NewTicketFile[] }
): Promise<TicketDetail> {
  const form = new FormData();
  form.append('subject', params.subject);
  form.append('body', params.body);
  form.append('category', params.category);
  for (const file of params.files) {
    // React Native's FormData accepts this { uri, name, type } object in
    // place of a web Blob/File - this is the one place in the app a value
    // other than string|Blob needs the `as any` RN's own FormData typings
    // require (see @types/react-native's FormData override).
    form.append('files', file as unknown as Blob);
  }
  return apiFetchForm<TicketDetail>('/support/tickets', { token, form });
}
