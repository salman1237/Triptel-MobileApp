import React, { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/state/AuthContext';
import { AppSettingsProvider, useAppSettings } from '../src/state/AppSettingsContext';
import MaintenanceGate from '../src/components/MaintenanceGate';

// A signed-in account's currency preference follows them across devices -
// same reasoning as the web app (D:\eSim\frontend\src\lib\AppSettingsContext.tsx).
function CurrencySync() {
  const { user } = useAuth();
  const { setCurrency } = useAppSettings();

  useEffect(() => {
    if (user?.preferred_currency) setCurrency(user.preferred_currency);
  }, [user?.preferred_currency, setCurrency]);

  return null;
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <AuthProvider>
          <CurrencySync />
          <MaintenanceGate>
            <Slot />
          </MaintenanceGate>
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
}
