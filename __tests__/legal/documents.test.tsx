import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getLegalDocument } from '../../src/api/settings';
import LegalDocumentScreen from '../../app/legal/[slug]';

jest.mock('../../src/api/settings', () => ({
  getLegalDocument: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockedGetLegalDocument = getLegalDocument as jest.Mock;

let mockCurrentSlug = 'terms';
const mockReplace = jest.fn((path: string) => {
  mockCurrentSlug = path.replace('/legal/', '');
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => ({ slug: mockCurrentSlug }),
}));

jest.mock('../../src/state/AppSettingsContext', () => ({
  useAppSettings: () => ({ t: (_ns: string, _key: string, fallback: string) => fallback }),
}));

async function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LegalDocumentScreen />
    </QueryClientProvider>
  );
}

describe('Legal documents (FR-1201)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentSlug = 'terms';
  });

  it('renders headings, a bullet list, and a bold paragraph from the markdown-lite body', async () => {
    mockedGetLegalDocument.mockResolvedValue({
      slug: 'terms',
      title: 'Terms & Conditions',
      updated_at: '2026-10-20T12:00:00Z',
      body: [
        '# The Service',
        '',
        'Welcome to **Triptel**. Contact us at support@triptel.co for help.',
        '',
        '## Rules',
        '- Be nice',
        '- Pay on time',
      ].join('\n'),
    });

    const { findByTestId } = await renderScreen();

    expect((await findByTestId('legal-title')).props.children).toBe('Terms & Conditions');
    expect((await findByTestId('legal-updated-at')).props.children).toEqual(['Last updated', ' ', '20 Oct 2026']);

    // Exact match, not { exact: false } - a mis-parsed "# The Service" line
    // would fall through to a plain paragraph at the same block index with
    // the same substring still present, just with a literal "#" prefix that
    // a partial match would miss.
    const heading = await findByTestId('legal-block-0');
    expect(heading).toHaveTextContent('The Service');

    const boldText = await findByTestId('legal-block-1-bold');
    expect(boldText).toHaveTextContent('Triptel', { exact: false });

    const emailLink = await findByTestId('legal-block-1-2-email');
    expect(emailLink).toHaveTextContent('support@triptel.co', { exact: false });

    // Exact match on each individual bullet item's own testID, not a
    // substring check against the whole block - a misparsed "- Be nice"
    // line falls through to a merged paragraph at the same block index,
    // which would still contain "Be nice" as a substring (same trap as the
    // heading check above).
    expect(await findByTestId('legal-block-3-item-0')).toHaveTextContent('Be nice', { exact: false });
    expect(await findByTestId('legal-block-3-item-1')).toHaveTextContent('Pay on time', { exact: false });
  });

  it('shows an error state when the document fails to load', async () => {
    mockedGetLegalDocument.mockRejectedValue(new Error('network down'));

    const { findByTestId } = await renderScreen();

    expect(await findByTestId('legal-error')).toBeTruthy();
  });

  it('switches documents when a different tab is pressed', async () => {
    mockedGetLegalDocument.mockImplementation((slug: string) =>
      Promise.resolve({ slug, title: `Doc: ${slug}`, updated_at: null, body: `Body for ${slug}` })
    );

    const { findByTestId, rerender } = await renderScreen();

    await waitFor(() => expect(mockedGetLegalDocument).toHaveBeenCalledWith('terms'));

    await fireEvent.press(await findByTestId('legal-tab-privacy'));
    expect(mockReplace).toHaveBeenCalledWith('/legal/privacy');

    // Simulate the route param actually changing (expo-router would re-render
    // this screen with the new slug) and confirm the new document is fetched.
    await rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LegalDocumentScreen />
      </QueryClientProvider>
    );
    await waitFor(() => expect(mockedGetLegalDocument).toHaveBeenCalledWith('privacy'));
  });
});
