import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  useColorScheme,
  Keyboard,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { validateLoginForm, ERROR_MESSAGES, INFO_MESSAGES } from "@trace/core";
import { useAuth } from "../../../shared/contexts/AuthContext";
import { GoogleIcon } from "../components/GoogleIcon";
import { FlowerLogo } from "../components/FlowerLogo";
import { authenticateWithBiometrics } from "../../../shared/utils/biometrics";

interface LoginScreenProps {
  onSwitchToSignUp: () => void;
}

export default function LoginScreen({ onSwitchToSignUp }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signInWithEmail, signInWithGoogle, offlineAccounts, continueOfflineAs, isOffline } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const c = isDark ? darkColors : lightColors;

  const handleEmailLogin = async () => {
    Keyboard.dismiss();
    const validation = validateLoginForm(email, password);
    if (!validation.isValid) {
      Alert.alert("Error", validation.error!);
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (error: unknown) {
      Alert.alert(
        ERROR_MESSAGES.LOGIN_FAILED,
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.error) {
        Alert.alert(
          ERROR_MESSAGES.GOOGLE_LOGIN_FAILED,
          result.error instanceof Error ? result.error.message : "Unknown error"
        );
      }
    } catch (error: unknown) {
      Alert.alert(
        ERROR_MESSAGES.GOOGLE_LOGIN_FAILED,
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async (userId: string, displayName: string) => {
    const result = await authenticateWithBiometrics(`Access ${displayName}'s account`);
    if (result.success) {
      continueOfflineAs(userId);
    } else {
      // user_cancel / system_cancel / app_cancel — the system already communicated; stay silent.
      // Anything else (lockout, not_enrolled, unknown) needs explicit feedback.
      const silentErrors = ['user_cancel', 'system_cancel', 'app_cancel'];
      if (!silentErrors.includes(result.error ?? '')) {
        const isLockout = result.error === 'lockout' || result.error === 'lockout_permanent';
        Alert.alert(
          'Authentication Failed',
          isLockout
            ? 'Too many failed attempts. Please use your passcode to unlock.'
            : 'Could not verify your identity. Please try again.'
        );
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView
        style={{ backgroundColor: c.background }}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>

          {/* Hero — always visible */}
          <View style={styles.hero}>
            <FlowerLogo size={112} />
            <Text style={[styles.appName, { color: c.text }]}>Trace</Text>
            <Text style={[styles.subtitle, { color: c.secondaryText }]}>
              {isOffline ? "You're offline" : "Sign in to continue"}
            </Text>
          </View>

          {isOffline ? (
            /* ── OFFLINE: biometric accounts only ── */
            offlineAccounts.length > 0 ? (
              <View style={styles.form}>
                <Text style={[styles.sectionLabel, { color: c.secondaryText }]}>
                  Offline access
                </Text>
                {offlineAccounts.map(account => (
                  <TouchableOpacity
                    key={account.userId}
                    style={[styles.biometricButton, { backgroundColor: c.inputBg }]}
                    onPress={() => handleBiometricLogin(account.userId, account.displayName)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.biometricButtonContent}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.biometricName, { color: c.text }]}>
                          {account.displayName}
                        </Text>
                        <Text style={[styles.biometricEmail, { color: c.secondaryText }]}>
                          {account.email}
                        </Text>
                      </View>
                      <Text style={[styles.biometricHint, { color: c.secondaryText }]}>
                        Face ID / fingerprint
                      </Text>
                    </View>
                    <Text style={[styles.biometricNote, { color: c.secondaryText }]}>
                      Local access only — notes will sync when back online
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={[styles.noOfflineCard, { backgroundColor: c.inputBg }]}>
                <Text style={[styles.noOfflineTitle, { color: c.text }]}>
                  No offline accounts
                </Text>
                <Text style={[styles.noOfflineBody, { color: c.secondaryText }]}>
                  Connect to the internet to sign in. To enable offline access, turn on Biometric Access in your profile settings.
                </Text>
              </View>
            )
          ) : (
            /* ── ONLINE: normal sign-in ── */
            <>
              <View style={styles.form}>
                <TextInput
                  style={[styles.input, { backgroundColor: c.inputBg, color: c.text }]}
                  placeholder="Email"
                  placeholderTextColor={c.secondaryText}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { backgroundColor: c.inputBg, color: c.text }]}
                  placeholder="Password"
                  placeholderTextColor={c.secondaryText}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleEmailLogin}
                />
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: c.primaryButton }, loading && styles.buttonDisabled]}
                  onPress={handleEmailLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>
                    {loading ? INFO_MESSAGES.SIGNING_IN : "Sign In"}
                  </Text>
                </TouchableOpacity>
                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: c.divider }]} />
                  <Text style={[styles.dividerText, { color: c.secondaryText }]}>or</Text>
                  <View style={[styles.dividerLine, { backgroundColor: c.divider }]} />
                </View>
                <TouchableOpacity
                  style={[styles.googleButton, { backgroundColor: c.inputBg }, loading && styles.buttonDisabled]}
                  onPress={handleGoogleLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <GoogleIcon />
                  <Text style={[styles.googleButtonText, { color: c.text }]}>
                    Continue with Google
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.signUpLink} onPress={onSwitchToSignUp}>
                <Text style={[styles.signUpText, { color: c.secondaryText }]}>
                  Don't have an account?{" "}
                  <Text style={{ color: c.primaryButton, fontWeight: "600" }}>Sign Up</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const lightColors = {
  background: "#FFFFFF",
  inputBg: "#F2F2F7",
  text: "#1C1C1E",
  secondaryText: "#8E8E93",
  divider: "#C6C6C8",
  primaryButton: "#007AFF",
};

const darkColors = {
  background: "#000000",
  inputBg: "#1C1C1E",
  text: "#FFFFFF",
  secondaryText: "#AEAEB2",
  divider: "#38383A",
  primaryButton: "#0A84FF",
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: 32,
  },
  hero: {
    alignItems: "center",
    gap: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: "600",
    fontFamily: "JetBrainsMono_600SemiBold",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 15,
  },
  form: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: { fontSize: 13 },
  googleButton: {
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  biometricButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  biometricButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  biometricName: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  biometricEmail: {
    fontSize: 13,
    marginTop: 1,
  },
  biometricHint: {
    fontSize: 13,
  },
  biometricNote: {
    fontSize: 12,
  },
  noOfflineCard: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 8,
  },
  noOfflineTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  noOfflineBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  signUpLink: {
    alignItems: "center",
    paddingVertical: 12,
  },
  signUpText: {
    fontSize: 14,
    textAlign: "center",
  },
});
