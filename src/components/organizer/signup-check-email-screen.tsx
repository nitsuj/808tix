import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegalFooterLinks } from '@/components/legal/legal-footer-links';
import { ThemedText } from '@/components/themed-text';
import { GlassCard } from '@/components/ui/glass-card';
import { OrganizerAmbientBackground } from '@/components/ui/organizer-ambient-background';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { validateResendConfirmationEmail } from '@/lib/organizer-auth-form';
import { formatAuthError, getSupabaseTargetInfo } from '@/lib/supabase-target';
import { chrome, fan, semantic, spacing, surface, text, typeScale } from '@/theme';

type SignUpCheckEmailScreenProps = {
  email: string;
  onBackToSignIn: () => void;
  onChangeEmail: () => void;
};

export function SignUpCheckEmailScreen({
  email,
  onBackToSignIn,
  onChangeEmail,
}: SignUpCheckEmailScreenProps) {
  const { resendSignUpConfirmation } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const supabaseTarget = getSupabaseTargetInfo();

  async function handleResend() {
    const validationError = validateResendConfirmationEmail(email);

    if (validationError) {
      setResendError(validationError);
      return;
    }

    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);

    const { error } = await resendSignUpConfirmation(email);

    if (error) {
      setResendError(formatAuthError(error, supabaseTarget));
    } else {
      setResendSuccess(true);
    }

    setIsResending(false);
  }

  return (
    <View style={styles.bootScreen}>
      <OrganizerAmbientBackground />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.brandBlock}>
          <Text style={styles.wordmark}>808Tickets</Text>
          <Text style={styles.eyebrow}>Almost there</Text>
        </View>

        <GlassCard style={styles.card} testID="auth-check-email">
          <Text style={styles.title} testID="auth-check-email-title">
            Check your email
          </Text>
          <ThemedText themeColor="textSecondary" style={styles.body}>
            We sent a confirmation link to{' '}
            <ThemedText type="defaultSemiBold" style={styles.emailInline}>
              {email}
            </ThemedText>
            . Open it to finish creating your 808Tickets account.
          </ThemedText>

          {resendError ? <ThemedText style={styles.errorText}>{resendError}</ThemedText> : null}
          {resendSuccess ? (
            <ThemedText themeColor="textSecondary" style={styles.successText}>
              Confirmation email sent again. Check your inbox and spam folder.
            </ThemedText>
          ) : null}

          <Pressable
            disabled={isResending}
            onPress={handleResend}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              isResending && styles.primaryButtonDisabled,
            ]}>
            {isResending ? (
              <ActivityIndicator color={chrome.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Resend confirmation email</Text>
            )}
          </Pressable>

          <Pressable onPress={onChangeEmail} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Use a different email</Text>
          </Pressable>

          <Pressable onPress={onBackToSignIn} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back to sign in</Text>
          </Pressable>
        </GlassCard>

        <View style={styles.envFooter}>
          <LegalFooterLinks centered variant="organizer" />
          {Platform.OS === 'web' ? (
            <Text style={styles.hint}>
              After you confirm, this tab will sign you in automatically.
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    backgroundColor: surface.background,
    flex: 1,
  },
  safeArea: {
    alignSelf: 'center',
    flex: 1,
    gap: spacing.five,
    justifyContent: 'center',
    maxWidth: MaxContentWidth,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.five,
    width: '100%',
  },
  brandBlock: {
    gap: spacing.two,
  },
  wordmark: {
    color: chrome.brand.wordmark,
    fontSize: typeScale.screenTitle.fontSize + 8,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 48,
  },
  eyebrow: {
    color: chrome.brand.eyebrow,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  card: {
    gap: spacing.three,
  },
  title: {
    color: text.primary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  emailInline: {
    color: fan.badgeText,
  },
  errorText: {
    color: semantic.errorSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  successText: {
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: fan.primary,
    borderRadius: 12,
    marginTop: spacing.two,
    paddingVertical: spacing.three,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: chrome.white,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: spacing.two,
  },
  secondaryButtonText: {
    color: fan.badgeText,
    fontSize: 15,
    fontWeight: '600',
  },
  envFooter: {
    alignItems: 'center',
    gap: spacing.two,
  },
  hint: {
    color: text.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
