import React from 'react';
import { Tabs } from 'expo-router';

// Explore (FR-201) and Profile (FR-1001) exist today. Sibling tabs (My
// eSIMs, Wallet, Refer - see docs/Architecture.md -> "Folder layout") get
// their own <Tabs.Screen> entry here when each one's FR is built, not
// speculatively. FR-1301 (the tab bar itself as its own feature - ordering,
// no Agent/Partner tabs) still needs its own pass once all five exist.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
