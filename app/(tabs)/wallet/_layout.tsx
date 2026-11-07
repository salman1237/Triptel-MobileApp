import React from 'react';
import { Stack } from 'expo-router';

// Wallet's own stack: index is the tab's landing screen, manual-deposit is
// a child route pushed on top of it (router.push('/wallet/manual-deposit')
// from index.tsx) - not a sibling tab. Without this nested Stack, Expo
// Router has no host to render manual-deposit into and the push silently
// falls back to the first tab (Explore) instead.
export default function WalletLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="manual-deposit" />
    </Stack>
  );
}
