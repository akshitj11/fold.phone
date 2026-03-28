import { AuthButton, AuthInput } from '@/components/auth';
import { AtIcon, LockIcon } from '@/components/icons';
import { OnboardingColors } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth-store';
import { useEmbeddedWallet, useLoginWithEmail, usePrivy } from '@privy-io/expo';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Keyboard,
  StatusBar,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCALE = SCREEN_WIDTH / 393;

export default function AuthScreen() {
  const router = useRouter();
  const { user, authenticated } = usePrivy();
  const embeddedWallet = useEmbeddedWallet();
  const { sendCode, loginWithCode, state } = useLoginWithEmail();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const finalizedRef = useRef(false);

  const isAwaitingCode = state.status === 'awaiting-code-input' || state.status === 'submitting-code';
  const isBusy =
    isSubmitting ||
    state.status === 'sending-code' ||
    state.status === 'submitting-code';

  const embeddedWalletAddress = embeddedWallet.account?.address || null;

  const linkWalletAndFinalize = useCallback(async (walletAddress: string | null) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    if (walletAddress) {
      const walletLinkResult = await apiRequest('/api/auth/wallet-link', {
        method: 'POST',
        body: JSON.stringify({ walletAddress }),
      });

      if (walletLinkResult.error) {
        console.warn('[auth] wallet link failed:', walletLinkResult.error);
      }
    }

    const privyUserId = user?.id || email;
    useAuthStore.getState().setPrivyAuth({
      isAuthenticated: true,
      user: {
        id: privyUserId,
        email,
        walletAddress,
      },
    });

    router.replace('/(tabs)' as any);
  }, [email, router, user?.id]);

  const handleSendCode = async () => {
    Keyboard.dismiss();

    if (!email.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendCode({ email: email.trim() });
      if (!result.success) {
        Alert.alert('Error', 'Unable to send code. Please try again.');
      }
    } catch (error) {
      console.error('[auth] send code failed:', error);
      Alert.alert('Error', 'Unable to send code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    Keyboard.dismiss();

    if (!email.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }

    if (!code.trim() || code.trim().length !== 6) {
      Alert.alert('Error', 'Enter a valid 6 digit code');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithCode({ code: code.trim(), email: email.trim() });
      await linkWalletAndFinalize(embeddedWalletAddress);
    } catch (error) {
      console.error('[auth] verify code failed:', error);
      Alert.alert('Error', 'Invalid code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (authenticated && user && !isBusy) {
      linkWalletAndFinalize(embeddedWalletAddress).catch((error) => {
        console.error('[auth] finalize login failed:', error);
      });
    }
  }, [authenticated, user, embeddedWalletAddress, isBusy, linkWalletAndFinalize]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={OnboardingColors.background} />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={40}
        >
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.title}>Fold</Text>

          <Text style={styles.subtitle}>
            The private space for your raw thoughts, memories, and emotions.
          </Text>

          <Text style={styles.encryptionLabel}>End - to - End Private</Text>

          <View style={styles.inputSection}>
            <AuthInput
              placeholder="Email"
              icon={<AtIcon size={20 * SCALE} color="#810100" />}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />

            {isAwaitingCode && (
              <AuthInput
                placeholder="6 digit code"
                icon={<LockIcon size={20 * SCALE} color="#810100" />}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
              />
            )}

            <View style={styles.buttonContainer}>
              <AuthButton
                title={isAwaitingCode ? 'Verify Code' : 'Send Code'}
                onPress={isAwaitingCode ? handleVerifyCode : handleSendCode}
                disabled={isBusy}
              />
            </View>
          </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OnboardingColors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 17 * SCALE,
    paddingBottom: 40 * SCALE,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40 * SCALE,
  },
  logo: {
    width: 125 * SCALE,
    height: 125 * SCALE,
    borderRadius: 25 * SCALE,
  },
  title: {
    fontSize: 48 * SCALE,
    fontFamily: 'SignPainter',
    textAlign: 'center',
    marginTop: 20 * SCALE,
    color: 'black',
  },
  subtitle: {
    fontSize: 16 * SCALE,
    textAlign: 'center',
    color: 'black',
    marginTop: 8 * SCALE,
    lineHeight: 24 * SCALE,
  },
  encryptionLabel: {
    fontSize: 13 * SCALE,
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.5)',
    marginTop: 25 * SCALE,
    marginBottom: 25 * SCALE,
  },
  inputSection: {
    marginTop: 0,
  },
  buttonContainer: {
    marginTop: 8 * SCALE,
  },
});
