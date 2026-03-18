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
  Linking,
  useColorScheme,
  Keyboard,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { validateSignupForm, ERROR_MESSAGES, INFO_MESSAGES } from "@trace/core";
import { useAuth } from "../../../shared/contexts/AuthContext";
import { GoogleIcon } from "../components/GoogleIcon";
import { FlowerLogo } from "../components/FlowerLogo";

interface SignUpScreenProps {
  onSwitchToLogin: () => void;
}

export default function SignUpScreen({ onSwitchToLogin }: SignUpScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const c = isDark ? darkColors : lightColors;

  const handleEmailSignup = async () => {
    Keyboard.dismiss();
    const validation = validateSignupForm(email, password, confirmPassword);
    if (!validation.isValid) {
      Alert.alert("Error", validation.error!);
      return;
    }

    setLoading(true);
    try {
      const result = await signUpWithEmail(email, password);
      if (result.user && !result.session) {
        onSwitchToLogin();
      }
    } catch (error: unknown) {
      Alert.alert(
        ERROR_MESSAGES.SIGNUP_FAILED,
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.error) {
        Alert.alert(
          ERROR_MESSAGES.GOOGLE_SIGNUP_FAILED,
          result.error instanceof Error ? result.error.message : "Unknown error"
        );
      }
    } catch (error: unknown) {
      Alert.alert(
        ERROR_MESSAGES.GOOGLE_SIGNUP_FAILED,
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setLoading(false);
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
          <View style={styles.hero}>
            <FlowerLogo size={112} />
            <Text style={[styles.appName, { color: c.text }]}>Trace</Text>
            <Text style={[styles.subtitle, { color: c.secondaryText }]}>
              Create your account
            </Text>
          </View>

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
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />

            <TextInput
              ref={confirmRef}
              style={[styles.input, { backgroundColor: c.inputBg, color: c.text }]}
              placeholder="Confirm Password"
              placeholderTextColor={c.secondaryText}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={handleEmailSignup}
            />

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: c.primaryButton }, loading && styles.buttonDisabled]}
              onPress={handleEmailSignup}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? INFO_MESSAGES.SIGNING_UP : "Create Account"}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: c.divider }]} />
              <Text style={[styles.dividerText, { color: c.secondaryText }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: c.divider }]} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, { backgroundColor: c.inputBg }, loading && styles.buttonDisabled]}
              onPress={handleGoogleSignup}
              disabled={loading}
              activeOpacity={0.8}
            >
              <GoogleIcon />
              <Text style={[styles.googleButtonText, { color: c.text }]}>
                Continue with Google
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.legalText, { color: c.secondaryText }]}>
              By continuing you agree to our{" "}
              <Text
                style={{ color: c.primaryButton }}
                onPress={() => Linking.openURL("https://www.mindjig.com/terms.html")}
              >
                Terms of Service
              </Text>
              {" "}and{" "}
              <Text
                style={{ color: c.primaryButton }}
                onPress={() => Linking.openURL("https://www.mindjig.com/privacy.html")}
              >
                Privacy Policy
              </Text>
            </Text>

            <TouchableOpacity style={styles.signInLink} onPress={onSwitchToLogin}>
              <Text style={[styles.signInText, { color: c.secondaryText }]}>
                Already have an account?{" "}
                <Text style={{ color: c.primaryButton, fontWeight: "600" }}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
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
  container: {
    flex: 1,
  },
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
  buttonDisabled: {
    opacity: 0.5,
  },
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
  dividerText: {
    fontSize: 13,
  },
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
  footer: {
    gap: 16,
    alignItems: "center",
  },
  legalText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  signInLink: {
    paddingVertical: 12,
  },
  signInText: {
    fontSize: 14,
    textAlign: "center",
  },
});
