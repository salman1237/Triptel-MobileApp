import React from 'react';
import { Tabs } from 'expo-router';

// FR-1301 - the five User App tabs, in this order, and no others: no
// Agent/Partner tabs exist in this app at all (see CLAUDE.md -> "Hard
// Constraints" - User App only). Each screen keeps its own top-level route
// path (e.g. /wallet, /refer) - the (tabs) group only changes where the
// file lives, not the URL, so existing deep links and router.push() calls
// elsewhere in the app are unaffected by this grouping.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
      <Tabs.Screen name="my-esims/index" options={{ title: 'My eSIMs' }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
      <Tabs.Screen name="refer/index" options={{ title: 'Refer' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
