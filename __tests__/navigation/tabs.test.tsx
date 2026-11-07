import React from 'react';
import { render } from '@testing-library/react-native';
import TabsLayout from '../../app/(tabs)/_layout';

type ScreenCall = { name: string; title?: string; href?: unknown };
let mockScreenCalls: ScreenCall[] = [];

jest.mock('expo-router', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const ReactActual = require('react');
  /* eslint-enable @typescript-eslint/no-require-imports */
  function Tabs({ children }: { children: React.ReactNode }) {
    return ReactActual.createElement(ReactActual.Fragment, null, children);
  }
  Tabs.Screen = function Screen({ name, options }: { name: string; options?: { title?: string; href?: unknown } }) {
    mockScreenCalls.push({ name, title: options?.title, href: options?.href });
    return null;
  };
  return { Tabs };
});

// FR-1301 - the five User App tabs (Explore/My eSIMs/Wallet/Refer/Profile),
// in that order, and nothing else - this app has no Agent or Partner role,
// so no tab for either can exist here (see CLAUDE.md -> "Hard Constraints").
describe('Bottom tab bar (FR-1301)', () => {
  beforeEach(() => {
    mockScreenCalls = [];
  });

  it('registers exactly Explore, My eSIMs, Wallet, Refer, Profile as visible tabs, in that order', async () => {
    await render(<TabsLayout />);
    const visibleTitles = mockScreenCalls.filter((s) => s.href !== null).map((s) => s.title);
    expect(visibleTitles).toEqual(['Explore', 'My eSIMs', 'Wallet', 'Refer', 'Profile']);
  });

  it('does not register any Agent or Partner tab', async () => {
    await render(<TabsLayout />);
    const labels = mockScreenCalls.map((s) => `${s.name} ${s.title ?? ''}`);
    expect(labels.some((l) => /agent/i.test(l))).toBe(false);
    expect(labels.some((l) => /partner/i.test(l))).toBe(false);
  });

  it('registers no separate manual-deposit tab - it lives inside the wallet tab\'s own stack', async () => {
    await render(<TabsLayout />);
    expect(mockScreenCalls.find((s) => s.name === 'wallet/manual-deposit')).toBeUndefined();
    expect(mockScreenCalls.find((s) => s.name === 'wallet')).toBeTruthy();
  });
});
