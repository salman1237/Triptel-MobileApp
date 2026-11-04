import React, { useState } from 'react';
import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/state/AuthContext';
import { AppSettingsProvider } from '../src/state/AppSettingsContext';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <AuthProvider>
          <Slot />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
}
