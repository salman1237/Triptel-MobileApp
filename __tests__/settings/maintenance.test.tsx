import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe } from '../../src/api/auth';
import { getPublicSettings } from '../../src/api/settings';
import MaintenanceGate from '../../src/components/MaintenanceGate';

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

jest.mock('../../src/api/auth', () => ({
  getMe: jest.fn(),
}));

jest.mock('../../src/api/settings', () => ({
  getLanguages: jest.fn().mockResolvedValue([]),
  getTranslations: jest.fn().mockResolvedValue({ language_code: 'en', namespaces: {} }),
  getRates: jest.fn().mockResolvedValue([]),
  getPublicSettings: jest.fn(),
}));

let mockPathname = '/';
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetPublicSettings = getPublicSettings as jest.Mock;

function publicSettings(overrides: Partial<{ maintenance_mode: boolean; platform_name: string }> = {}) {
  return {
    bangla_qr_image: null,
    payment_methods: [],
    platform_name: 'Triptel',
    maintenance_mode: false,
    ...overrides,
  };
}

function meResponseBody(overrides: Partial<{ role: string }> = {}) {
  return {
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
    ...overrides,
  };
}

async function renderGate({
  maintenanceMode,
  signedIn,
  role = 'USER',
  path = '/',
}: {
  maintenanceMode: boolean;
  signedIn: boolean;
  role?: string;
  path?: string;
}) {
  mockPathname = path;
  mockedGetPublicSettings.mockResolvedValue(publicSettings({ maintenance_mode: maintenanceMode }));

  if (signedIn) {
    mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
    mockedGetMe.mockResolvedValue(meResponseBody({ role }));
  } else {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
  }

  const utils = await render(
    <AppSettingsProvider>
      <AuthProvider>
        <MaintenanceGate>
          <Text testID="app-shell">App shell</Text>
        </MaintenanceGate>
      </AuthProvider>
    </AppSettingsProvider>
  );
  await waitFor(() => expect(utils.queryByTestId('app-settings-bootstrap-loading')).toBeNull());
  return utils;
}

// FR-1203 - a maintenance-flagged backend shows a blocking screen instead
// of the app shell, except for admins and the (not-yet-built) public
// tracking screen, which stays available for a customer with nothing but
// a delivery-email link. Ported from the web's
// src/components/MaintenanceGate.tsx.
describe('Maintenance mode (FR-1203)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/';
  });

  it('renders the app shell normally when maintenance mode is off', async () => {
    const { findByTestId, queryByTestId } = await renderGate({ maintenanceMode: false, signedIn: false });
    expect(await findByTestId('app-shell')).toBeTruthy();
    expect(queryByTestId('maintenance-gate')).toBeNull();
  });

  it('blocks a signed-out visitor when maintenance mode is on', async () => {
    const { findByTestId, queryByTestId } = await renderGate({ maintenanceMode: true, signedIn: false });
    expect(await findByTestId('maintenance-gate')).toBeTruthy();
    expect(queryByTestId('app-shell')).toBeNull();
  });

  it('blocks a signed-in regular user when maintenance mode is on', async () => {
    const { findByTestId, queryByTestId } = await renderGate({ maintenanceMode: true, signedIn: true, role: 'USER' });
    expect(await findByTestId('maintenance-gate')).toBeTruthy();
    expect(queryByTestId('app-shell')).toBeNull();
  });

  it('lets a SUPER_ADMIN through during maintenance mode', async () => {
    const { findByTestId, queryByTestId } = await renderGate({
      maintenanceMode: true,
      signedIn: true,
      role: 'SUPER_ADMIN',
    });
    expect(await findByTestId('app-shell')).toBeTruthy();
    expect(queryByTestId('maintenance-gate')).toBeNull();
  });

  it('keeps the public tracking path available during maintenance mode', async () => {
    const { findByTestId, queryByTestId } = await renderGate({
      maintenanceMode: true,
      signedIn: false,
      path: '/track/abc123',
    });
    expect(await findByTestId('app-shell')).toBeTruthy();
    expect(queryByTestId('maintenance-gate')).toBeNull();
  });
});
