import { OnboardingColors } from '@/constants/theme';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCALE = SCREEN_WIDTH / 393;

interface AuthButtonProps {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
}

export function AuthButton({ title, onPress, disabled = false }: AuthButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.containerDisabled]}
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: OnboardingColors.primary,
    borderRadius: 15 * SCALE,
    height: 60 * SCALE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerDisabled: {
    opacity: 0.55,
  },
  text: {
    fontSize: 18 * SCALE,
    color: 'white',
    fontWeight: '500',
  },
});
