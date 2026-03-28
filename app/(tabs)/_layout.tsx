import { Tabs } from 'expo-router';
import React from 'react';

/**
 * Tab layout - simplified since we now use PagerView for Hub/Timeline/Profile navigation.
 * The index screen contains the swipeable pager with all three pages.
 * Other screens (explore, settings) are hidden from tabs but still accessible via routing.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Hide the default tab bar since we use custom BottomNavBar
        tabBarStyle: { display: 'none' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      {/* Hub and Profile are now part of the pager in index, hide them */}
      <Tabs.Screen
        name="hub"
        options={{
          title: 'Hub',
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          href: null,
        }}
      />
      <Tabs.Screen
        name="shared"
        options={{
          title: 'Shared',
          href: null,
        }}
      />
    </Tabs>
  );
}
