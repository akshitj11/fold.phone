import { TimelineColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useBiometricLock } from '@/lib/biometric-lock';
import { useSettings } from '@/lib/settings-context';
import { usePrivy } from '@privy-io/expo';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCALE = SCREEN_WIDTH / 393;

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { logout } = usePrivy();
  const { isEnabled, isAvailable, biometricType, enable, disable } = useBiometricLock();
  const {
    autoLocation,
    updateAutoLocation,
    screenshotProtection,
    updateScreenshotProtection,
    isSettingsLoading,
    profileStats,
    isStatsLoading,
    refresh: refreshSettings,
  } = useSettings();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isTogglingBiometric, setIsTogglingBiometric] = useState(false);
  const [isTogglingLocation, setIsTogglingLocation] = useState(false);
  const [isTogglingScreenshot, setIsTogglingScreenshot] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshSettings(); } finally { setRefreshing(false); }
  }, [refreshSettings]);

  const handleBack = () => {
    router.back();
  };

  const handleToggleBiometric = async () => {
    if (isTogglingBiometric) return;
    setIsTogglingBiometric(true);
    try {
      if (isEnabled) {
        await disable();
      } else {
        const success = await enable();
        if (!success) {
          Alert.alert('Failed', 'Biometric authentication failed. Please try again.');
        }
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsTogglingBiometric(false);
    }
  };

  const handleToggleAutoLocation = async () => {
    if (isTogglingLocation || isSettingsLoading) return;
    setIsTogglingLocation(true);
    try {
      await updateAutoLocation(!autoLocation);
    } catch {
      Alert.alert('Error', 'Could not update location setting. Please try again.');
    } finally {
      setIsTogglingLocation(false);
    }
  };

  const handleToggleScreenshot = async () => {
    if (isTogglingScreenshot || isSettingsLoading) return;
    setIsTogglingScreenshot(true);
    try {
      await updateScreenshotProtection(!screenshotProtection);
    } catch {
      Alert.alert('Error', 'Could not update screenshot protection. Please try again.');
    } finally {
      setIsTogglingScreenshot(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
              await signOut();
              // The auth context will update hasSeenOnboarding to false
              // and the route protection will redirect to onboarding
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={TimelineColors.background} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <BackIcon size={24 * SCALE} />
        </Pressable>
        <Text style={styles.topBarTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={TimelineColors.primary}
            colors={[TimelineColors.primary]}
          />
        }
      >
        {/* Your Fold Stats Section */}
        {(profileStats || isStatsLoading) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Fold</Text>
            <View style={styles.card}>
              <View style={styles.statsGrid}>
                <StatCell
                  label="Total Entries"
                  value={isStatsLoading ? '—' : String(profileStats?.totalEntries ?? 0)}
                />
                <StatCell
                  label="Current Streak"
                  value={isStatsLoading ? '—' : `${profileStats?.currentStreak ?? 0}d`}
                />
                <StatCell
                  label="Fold Score"
                  value={isStatsLoading ? '—' : String(profileStats?.foldScore ?? 0)}
                />
                <StatCell
                  label="Longest Streak"
                  value={isStatsLoading ? '—' : `${profileStats?.longestStreak ?? 0}d`}
                />
              </View>
            </View>
          </View>
        )}

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <SettingsRow
              icon={<UserIcon size={20 * SCALE} />}
              label="Edit Profile"
              onPress={() => router.push('/edit-profile' as any)}
            />
            <Divider />
            <SettingsRow
              icon={<LockIcon size={20 * SCALE} />}
              label="Change Password"
              onPress={() => router.push('/change-password' as any)}
            />
            <Divider />
            <SettingsRow
              icon={<ShieldIcon size={20 * SCALE} />}
              label="Privacy"
              onPress={() => router.push('/help' as any)}
            />
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.card}>
            {isAvailable ? (
              <View style={styles.settingsRow}>
                <View style={styles.rowLeft}>
                  <FingerprintSettingsIcon size={20 * SCALE} />
                  <View>
                    <Text style={styles.rowLabel}>{biometricType ?? 'Biometric'} Lock</Text>
                    <Text style={styles.rowSubLabel}>
                      Lock app when you leave
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isEnabled}
                  onValueChange={handleToggleBiometric}
                  disabled={isTogglingBiometric}
                  trackColor={{ false: 'rgba(0,0,0,0.1)', true: 'rgba(129, 1, 0, 0.35)' }}
                  thumbColor={isEnabled ? TimelineColors.primary : '#f4f3f4'}
                />
              </View>
            ) : (
              <View style={styles.settingsRow}>
                <View style={styles.rowLeft}>
                  <FingerprintSettingsIcon size={20 * SCALE} />
                  <View>
                    <Text style={styles.rowLabel}>Biometric Lock</Text>
                    <Text style={styles.rowSubLabel}>
                      Not available on this device
                    </Text>
                  </View>
                </View>
              </View>
            )}
            <Divider />
            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <ScreenshotIcon size={20 * SCALE} />
                <View>
                  <Text style={styles.rowLabel}>Screenshot Protection</Text>
                  <Text style={styles.rowSubLabel}>
                    Prevent screenshots and screen recording
                  </Text>
                </View>
              </View>
              <Switch
                value={screenshotProtection}
                onValueChange={handleToggleScreenshot}
                disabled={isTogglingScreenshot || isSettingsLoading}
                trackColor={{ false: 'rgba(0,0,0,0.1)', true: 'rgba(129, 1, 0, 0.35)' }}
                thumbColor={screenshotProtection ? TimelineColors.primary : '#f4f3f4'}
              />
            </View>
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            <SettingsRow
              icon={<BellIcon size={20 * SCALE} />}
              label="Notifications"
              onPress={() => router.push('/notifications' as any)}
            />
            <Divider />
            <SettingsRow
              icon={<PaletteIcon size={20 * SCALE} />}
              label="Appearance"
              onPress={() => router.push('/appearance' as any)}
            />
            <Divider />
            <View style={styles.settingsRow}>
              <View style={styles.rowLeft}>
                <LocationSettingsIcon size={20 * SCALE} />
                <View>
                  <Text style={styles.rowLabel}>Auto-location</Text>
                  <Text style={styles.rowSubLabel}>
                    Attach location to every entry
                  </Text>
                </View>
              </View>
              <Switch
                value={autoLocation}
                onValueChange={handleToggleAutoLocation}
                disabled={isTogglingLocation || isSettingsLoading}
                trackColor={{ false: 'rgba(0,0,0,0.1)', true: 'rgba(129, 1, 0, 0.35)' }}
                thumbColor={autoLocation ? TimelineColors.primary : '#f4f3f4'}
              />
            </View>
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.card}>
            <SettingsRow
              icon={<HelpIcon size={20 * SCALE} />}
              label="Help & FAQ"
              onPress={() => router.push('/help' as any)}
            />
            <Divider />
            <SettingsRow
              icon={<InfoIcon size={20 * SCALE} />}
              label="About"
              onPress={() => router.push('/about' as any)}
            />
          </View>
        </View>

        {/* Logout Button */}
        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
          ]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <LogoutIcon size={20 * SCALE} />
          <Text style={styles.logoutText}>
            {isLoggingOut ? 'Logging out...' : 'Log Out'}
          </Text>
        </Pressable>

        {/* App Version */}
        <Text style={styles.versionText}>Fold v1.0.0</Text>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Settings row component
function SettingsRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsRow,
        pressed && styles.settingsRowPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        {icon}
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <ChevronRightIcon size={16 * SCALE} />
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Icons
function BackIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke={TimelineColors.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronRightIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M6 12L10 8L6 4"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function UserIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx="10" cy="6" r="4" stroke={TimelineColors.primary} strokeWidth={1.5} />
      <Path
        d="M3 18C3 14.134 6.134 11 10 11C13.866 11 17 14.134 17 18"
        stroke={TimelineColors.primary}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function LockIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M5 9V7C5 4.239 7.239 2 10 2C12.761 2 15 4.239 15 7V9"
        stroke={TimelineColors.primary}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M4 9H16C16.552 9 17 9.448 17 10V17C17 17.552 16.552 18 16 18H4C3.448 18 3 17.552 3 17V10C3 9.448 3.448 9 4 9Z"
        stroke={TimelineColors.primary}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function ShieldIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 2L3 5V9.5C3 13.64 5.95 17.52 10 18.5C14.05 17.52 17 13.64 17 9.5V5L10 2Z"
        stroke={TimelineColors.primary}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BellIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 2C7.239 2 5 4.239 5 7V10L3 13H17L15 10V7C15 4.239 12.761 2 10 2Z"
        stroke={TimelineColors.primary}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M8 16C8 17.105 8.895 18 10 18C11.105 18 12 17.105 12 16"
        stroke={TimelineColors.primary}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function PaletteIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx="10" cy="10" r="8" stroke={TimelineColors.primary} strokeWidth={1.5} />
      <Circle cx="7" cy="8" r="1.5" fill={TimelineColors.primary} />
      <Circle cx="13" cy="8" r="1.5" fill={TimelineColors.primary} />
      <Circle cx="10" cy="13" r="1.5" fill={TimelineColors.primary} />
    </Svg>
  );
}

function HelpIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx="10" cy="10" r="8" stroke={TimelineColors.primary} strokeWidth={1.5} />
      <Path
        d="M7.5 7.5C7.5 6.119 8.619 5 10 5C11.381 5 12.5 6.119 12.5 7.5C12.5 8.881 11.381 10 10 10V11.5"
        stroke={TimelineColors.primary}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle cx="10" cy="14" r="1" fill={TimelineColors.primary} />
    </Svg>
  );
}

function InfoIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx="10" cy="10" r="8" stroke={TimelineColors.primary} strokeWidth={1.5} />
      <Path
        d="M10 9V14"
        stroke={TimelineColors.primary}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle cx="10" cy="6" r="1" fill={TimelineColors.primary} />
    </Svg>
  );
}

function LogoutIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M7 3H4C3.448 3 3 3.448 3 4V16C3 16.552 3.448 17 4 17H7"
        stroke="#DC2626"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M10 10H17M17 10L14 7M17 10L14 13"
        stroke="#DC2626"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FingerprintSettingsIcon({ size = 20 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/fingerprint-pattern-1.png')}
      style={{
        width: size,
        height: size,
        tintColor: TimelineColors.primary,
      }}
      resizeMode="contain"
    />
  );
}

function LocationSettingsIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
        fill={TimelineColors.primary}
      />
    </Svg>
  );
}

function ScreenshotIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Eye-off icon */}
      <Path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
        stroke={TimelineColors.primary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M1 1L23 23"
        stroke={TimelineColors.primary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TimelineColors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 17 * SCALE,
    paddingTop: 5 * SCALE,
    height: 55 * SCALE,
  },
  backButton: {
    width: 40 * SCALE,
    height: 40 * SCALE,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topBarTitle: {
    fontSize: 18 * SCALE,
    fontWeight: '600',
    color: TimelineColors.textDark,
  },
  placeholder: {
    width: 40 * SCALE,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 17 * SCALE,
    paddingTop: 10 * SCALE,
  },
  section: {
    marginBottom: 24 * SCALE,
  },
  sectionTitle: {
    fontSize: 13 * SCALE,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.5)',
    marginBottom: 8 * SCALE,
    marginLeft: 4 * SCALE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FDFBF7',
    borderRadius: 16 * SCALE,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16 * SCALE,
    paddingVertical: 14 * SCALE,
  },
  settingsRowPressed: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12 * SCALE,
  },
  rowLabel: {
    fontSize: 15 * SCALE,
    fontWeight: '500',
    color: TimelineColors.textDark,
  },
  rowSubLabel: {
    fontSize: 12 * SCALE,
    fontWeight: '400',
    color: 'rgba(0,0,0,0.4)',
    marginTop: 2 * SCALE,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginLeft: 48 * SCALE,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10 * SCALE,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    paddingVertical: 14 * SCALE,
    borderRadius: 16 * SCALE,
    marginTop: 8 * SCALE,
  },
  logoutButtonPressed: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
  },
  logoutText: {
    fontSize: 15 * SCALE,
    fontWeight: '600',
    color: '#DC2626',
  },
  versionText: {
    fontSize: 12 * SCALE,
    color: 'rgba(0,0,0,0.3)',
    textAlign: 'center',
    marginTop: 24 * SCALE,
  },
  bottomPadding: {
    height: 40 * SCALE,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCell: {
    width: '50%',
    paddingHorizontal: 16 * SCALE,
    paddingVertical: 16 * SCALE,
    alignItems: 'center',
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.07)',
  },
  statValue: {
    fontSize: 22 * SCALE,
    fontWeight: '700',
    color: TimelineColors.primary,
    marginBottom: 4 * SCALE,
  },
  statLabel: {
    fontSize: 11 * SCALE,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
