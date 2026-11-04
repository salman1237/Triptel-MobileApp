import React from 'react';
import { Tabs } from 'expo-router';

// Only the Explore tab exists today (FR-201). Sibling tabs (My eSIMs, Wallet,
// Refer, Profile - see docs/Architecture.md -> "Folder layout") get their own
// <Tabs.Screen> entry here when each one's FR is built, not speculatively.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
    </Tabs>
  );
}
