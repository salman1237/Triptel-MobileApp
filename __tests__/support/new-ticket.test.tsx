import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe } from '../../src/api/auth';
import { createTicket, getCategories } from '../../src/api/support';
import { ApiError } from '../../src/lib/apiClient';
import NewTicketScreen from '../../app/support/new';

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
  getCategories: jest.fn(),
  createTicket: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetCategories = getCategories as jest.Mock;
const mockedCreateTicket = createTicket as jest.Mock;
const mockedRequestPermissions = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockedLaunchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

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

const categoryOptions = [
  { value: 'ESIM', label: 'eSIM not working' },
  { value: 'PAYMENT', label: 'Payment or top-up' },
  { value: 'OTHER', label: 'Something else' },
];

function imageAsset(uri: string, fileName: string) {
  return { uri, fileName, mimeType: 'image/jpeg' };
}

async function renderScreen() {
  mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
  mockedGetMe.mockResolvedValue(meResponseBody);
  mockedGetCategories.mockResolvedValue(categoryOptions);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = await render(
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <AuthProvider>
          <NewTicketScreen />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

// FR-1102 - open a ticket with subject/category/body and up to 5 attachments.
describe('New support ticket (FR-1102)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a chip for every category from the backend, OTHER selected by default', async () => {
    const { findByTestId } = await renderScreen();

    for (const c of categoryOptions) {
      expect(await findByTestId(`new-ticket-category-${c.value}`)).toBeTruthy();
    }
    expect((await findByTestId('new-ticket-category-OTHER')).props.accessibilityState.selected).toBe(true);
  });

  it('disables submit until subject and body are filled in', async () => {
    const { getByTestId } = await renderScreen();

    expect(getByTestId('new-ticket-submit').props.accessibilityState?.disabled ?? true).toBe(true);

    await fireEvent.changeText(getByTestId('new-ticket-subject-input'), 'eSIM not working');
    expect(getByTestId('new-ticket-submit').props.accessibilityState?.disabled ?? true).toBe(true);

    await fireEvent.changeText(getByTestId('new-ticket-body-input'), 'It shows no signal in Dubai.');
    expect(getByTestId('new-ticket-submit').props.accessibilityState?.disabled).toBe(false);
  });

  it('submits subject/category/body and routes to the ticket list on success', async () => {
    mockedCreateTicket.mockResolvedValue({ id: 't9', subject: 'eSIM not working' });
    const { getByTestId, findByTestId } = await renderScreen();

    await fireEvent.changeText(getByTestId('new-ticket-subject-input'), 'eSIM not working');
    await fireEvent.press(await findByTestId('new-ticket-category-ESIM'));
    await fireEvent.changeText(getByTestId('new-ticket-body-input'), 'It shows no signal in Dubai.');
    await fireEvent.press(getByTestId('new-ticket-submit'));

    await waitFor(() =>
      expect(mockedCreateTicket).toHaveBeenCalledWith('existing-token', {
        subject: 'eSIM not working',
        body: 'It shows no signal in Dubai.',
        category: 'ESIM',
        files: [],
      })
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/support'));
  });

  it('shows the backend error and stays on the form when creation fails', async () => {
    mockedCreateTicket.mockRejectedValue(new ApiError(400, 'Subject is too short'));
    const { getByTestId, findByTestId } = await renderScreen();

    await fireEvent.changeText(getByTestId('new-ticket-subject-input'), 'eSIM not working');
    await fireEvent.changeText(getByTestId('new-ticket-body-input'), 'It shows no signal in Dubai.');
    await fireEvent.press(getByTestId('new-ticket-submit'));

    expect((await findByTestId('new-ticket-error')).props.children).toBe('Subject is too short');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('adds picked attachments and caps the total at 5', async () => {
    mockedRequestPermissions.mockResolvedValue({ granted: true });
    mockedLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [
        imageAsset('file:///a.jpg', 'a.jpg'),
        imageAsset('file:///b.jpg', 'b.jpg'),
        imageAsset('file:///c.jpg', 'c.jpg'),
        imageAsset('file:///d.jpg', 'd.jpg'),
        imageAsset('file:///e.jpg', 'e.jpg'),
        imageAsset('file:///f.jpg', 'f.jpg'),
      ],
    });
    const { getByTestId, findByTestId, queryByTestId } = await renderScreen();

    await fireEvent.press(getByTestId('new-ticket-add-attachment'));

    expect(await findByTestId('new-ticket-attachment-4')).toBeTruthy();
    expect(queryByTestId('new-ticket-attachment-5')).toBeNull();
    // At the cap, the add button is disabled rather than letting another
    // pick push the count past 5.
    expect(getByTestId('new-ticket-add-attachment').props.accessibilityState?.disabled).toBe(true);
  });

  it('removes a picked attachment', async () => {
    mockedRequestPermissions.mockResolvedValue({ granted: true });
    mockedLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [imageAsset('file:///a.jpg', 'a.jpg')],
    });
    const { getByTestId, findByTestId, queryByTestId } = await renderScreen();

    await fireEvent.press(getByTestId('new-ticket-add-attachment'));
    await findByTestId('new-ticket-attachment-0');

    await fireEvent.press(getByTestId('new-ticket-attachment-remove-0'));

    expect(queryByTestId('new-ticket-attachment-0')).toBeNull();
  });
});
