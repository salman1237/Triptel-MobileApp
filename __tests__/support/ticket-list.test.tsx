import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe } from '../../src/api/auth';
import { getMyTickets } from '../../src/api/support';
import SupportTicketListScreen from '../../app/support/index';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/api/settings', () => ({
  getLanguages: jest.fn().mockResolvedValue([]),
  getTranslations: jest.fn().mockResolvedValue({ language_code: 'en', namespaces: {} }),
  getRates: jest.fn().mockResolvedValue([]),
  getPublicSettings: jest.fn().mockResolvedValue({ bangla_qr_image: null, payment_methods: [] }),
}));

jest.mock('../../src/api/auth', () => ({
  getMe: jest.fn(),
}));

jest.mock('../../src/api/support', () => ({
  getMyTickets: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetMyTickets = getMyTickets as jest.Mock;

const meResponseBody = {
  id: 'u1',
  email: 'traveler@example.com',
  username: 'traveler',
  role: 'USER',
  status: 'ACTIVE',
  phone: null,
  full_name: 'Traveler One',
  is_kyc_verified: false,
  preferred_currency: 'EUR',
  avatar_url: null,
  email_verified: true,
  has_google: false,
  wallets: [],
  merchant_profile: null,
  agent_profile: null,
};

function ticket(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 't1',
    reference: 'TKT-0001',
    subject: 'My eSIM will not connect',
    category: 'ESIM',
    status: 'OPEN',
    order_id: null,
    created_at: '2026-10-01T10:00:00Z',
    last_message_at: '2026-10-02T15:30:00Z',
    resolved_at: null,
    closed_at: null,
    ...overrides,
  };
}

async function renderScreen() {
  mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
  mockedGetMe.mockResolvedValue(meResponseBody);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = await render(
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <AuthProvider>
          <SupportTicketListScreen />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

describe('Support ticket list (FR-1101)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows each ticket with subject, reference, status, and last-message date', async () => {
    mockedGetMyTickets.mockResolvedValue([
      ticket({ id: 't1', subject: 'My eSIM will not connect', reference: 'TKT-0001', status: 'OPEN' }),
      ticket({
        id: 't2',
        subject: 'Refund question',
        reference: 'TKT-0002',
        status: 'RESOLVED',
        last_message_at: '2026-09-15T08:00:00Z',
      }),
    ]);

    const { findByTestId } = await renderScreen();

    expect((await findByTestId('ticket-subject-t1')).props.children).toBe('My eSIM will not connect');
    expect((await findByTestId('ticket-reference-t1')).props.children).toBe('TKT-0001');
    const status1 = await findByTestId('ticket-status-t1');
    expect(status1.props.children.props.children).toBe('Waiting for support');
    expect((await findByTestId('ticket-last-message-t1')).props.children).toBe('02 Oct 2026');

    expect((await findByTestId('ticket-subject-t2')).props.children).toBe('Refund question');
    const status2 = await findByTestId('ticket-status-t2');
    expect(status2.props.children.props.children).toBe('Resolved');
    expect((await findByTestId('ticket-last-message-t2')).props.children).toBe('15 Sept 2026');
  });

  it('shows an empty state when there are no tickets yet', async () => {
    mockedGetMyTickets.mockResolvedValue([]);

    const { findByTestId } = await renderScreen();

    expect(await findByTestId('ticket-list-empty')).toBeTruthy();
  });

  it('shows an error state when the tickets fail to load', async () => {
    mockedGetMyTickets.mockRejectedValue(new Error('network down'));

    const { findByTestId } = await renderScreen();

    expect(await findByTestId('ticket-list-error')).toBeTruthy();
  });

  it('navigates to the ticket thread and to the new-ticket screen', async () => {
    mockedGetMyTickets.mockResolvedValue([ticket({ id: 't1' })]);

    const { findByTestId, getByTestId } = await renderScreen();

    await fireEvent.press(await findByTestId('ticket-item-t1'));
    expect(mockPush).toHaveBeenNthCalledWith(1, '/support/t1');

    await fireEvent.press(getByTestId('ticket-list-new-ticket'));
    expect(mockPush).toHaveBeenNthCalledWith(2, '/support/new');
  });
});
