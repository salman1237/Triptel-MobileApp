import React from 'react';
import { Tabs } from 'expo-router';
// Imported from its own subpath, not the '@expo/vector-icons' barrel -
// the barrel's IconsLazy.js eagerly bundles every icon set's font file,
// and Metro on this project fails to resolve one of them (Fontisto.ttf)
// as an asset, crashing the whole app at launch. This subpath import
// only needs Ionicons.ttf, which resolves fine.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';

// React Navigation's tabBarIcon color is typed as ColorValue (which admits
// numbers/platform color objects/null), but Ionicons only accepts a string
// or NativeColorValue - this app's theme is always a plain hex string in
// practice, so fall back to a sane default for the types ColorValue allows
// but Ionicons doesn't.
function tabIcon(name: React.ComponentProps<typeof Ionicons>['name']) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={typeof color === 'string' ? color : '#64748B'} />
  );
}

// FR-1301 - the five User App tabs, in this order, and no others: no
// Agent/Partner tabs exist in this app at all (see CLAUDE.md -> "Hard
// Constraints" - User App only). Each screen keeps its own top-level route
// path (e.g. /wallet, /refer) - the (tabs) group only changes where the
// file lives, not the URL, so existing deep links and router.push() calls
// elsewhere in the app are unaffected by this grouping.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Explore', tabBarIcon: tabIcon('compass-outline') }} />
      <Tabs.Screen
        name="my-esims/index"
        options={{ title: 'My eSIMs', tabBarIcon: tabIcon('phone-portrait-outline') }}
      />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet', tabBarIcon: tabIcon('wallet-outline') }} />
      <Tabs.Screen name="refer/index" options={{ title: 'Refer', tabBarIcon: tabIcon('gift-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline') }} />
    </Tabs>
  );
}
