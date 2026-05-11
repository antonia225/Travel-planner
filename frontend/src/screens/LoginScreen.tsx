import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  teal700: "#0f766e",
  teal600: "#0d9488",
  teal200: "#99f6e4",
  teal100: "#ccfbf1",
  teal50: "#f0fdfa",
  tealBorder: "#5eead4",
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  white: "#ffffff",
  red500: "#ef4444",
  red700: "#b91c1c",
  red50: "#fef2f2",
  redBorder: "#fca5a5",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const isFormValid = email.trim().length > 0 && password.length > 0;

  const handleLogin = async () => {
    setErrorMessage("");

    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setErrorMessage(errorMsg);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <View style={s.hero}>
            {/* App icon badge */}
            <View style={s.iconBadge}>
              <Text style={{ fontSize: 28 }}>✈️</Text>
            </View>

            <Text style={s.heroHeading}>Welcome{"\n"}Back</Text>
            <Text style={s.heroSub}>
              Sign in to your account and continue planning your perfect trip
            </Text>

            {/* Decorative stat row */}
            <View style={s.statRow}>
              {[
                ["🗺️", "Explore"],
                ["📋", "Plan"],
                ["🚀", "Discover"],
              ].map(([icon, label]) => (
                <View key={label} style={s.stat}>
                  <Text style={s.statIcon}>{icon}</Text>
                  <Text style={s.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Form card ── */}
          <View style={s.card}>
            {/* Error banner */}
            {errorMessage !== "" && (
              <View style={s.bannerError}>
                <View style={s.bannerDotRed}>
                  <Text style={s.bannerDotText}>!</Text>
                </View>
                <Text style={s.bannerTextRed}>{errorMessage}</Text>
              </View>
            )}

            {/* ── Email ── */}
            <Text style={s.label}>Email Address</Text>
            <TextInput
              style={[s.input, emailFocused && s.inputFocused]}
              placeholder="you@example.com"
              placeholderTextColor={C.slate400}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            {/* ── Password ── */}
            <Text style={s.label}>Password</Text>
            <TextInput
              style={[s.input, passwordFocused && s.inputFocused, { marginBottom: 28 }]}
              placeholder="Enter your password"
              placeholderTextColor={C.slate400}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />

            {/* ── Submit ── */}
            <TouchableOpacity
              style={[
                s.button,
                !isFormValid || isLoading ? s.buttonDisabled : s.buttonActive,
              ]}
              onPress={handleLogin}
              disabled={!isFormValid || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={isFormValid ? C.white : C.slate400} />
              ) : (
                <Text
                  style={[
                    s.buttonText,
                    !isFormValid && s.buttonTextDisabled,
                  ]}
                >
                  Sign In
                </Text>
              )}
            </TouchableOpacity>

            {/* ── Switch to Register ── */}
            <View style={s.switchContainer}>
              <Text style={s.switchText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Register") }>
                <Text style={s.switchLink}>Create one</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.footer}>
              By signing in you agree to our Terms &amp; Privacy Policy
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.teal700 },

  // Hero
  hero: {
    backgroundColor: C.teal700,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 60,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  heroHeading: {
    fontSize: 40,
    fontWeight: "800",
    color: C.white,
    lineHeight: 46,
    marginBottom: 10,
  },
  heroSub: {
    fontSize: 14,
    color: C.teal200,
    lineHeight: 20,
    marginBottom: 28,
  },

  statRow: { flexDirection: "row", gap: 16 },
  stat: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statLabel: {
    fontSize: 10,
    color: C.teal100,
    fontWeight: "600",
    textAlign: "center",
  },

  // Card
  card: {
    backgroundColor: C.slate50,
    marginTop: -28,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 48,
    flex: 1,
  },

  // Banners
  bannerError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: C.red50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.redBorder,
    padding: 14,
    marginBottom: 20,
  },
  bannerDotRed: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.red500,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  bannerDotText: { color: C.white, fontSize: 11, fontWeight: "700" },
  bannerTextRed: {
    flex: 1,
    color: C.red700,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 20,
  },

  // Inputs
  label: {
    color: C.slate500,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.white,
    color: C.slate900,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.slate200,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 20,
  },
  inputFocused: {
    borderColor: C.teal600,
    backgroundColor: C.teal50,
  },

  // Button
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonActive: { backgroundColor: C.teal600 },
  buttonDisabled: { backgroundColor: C.slate200 },
  buttonText: {
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  buttonTextDisabled: { color: C.slate400 },

  // Switch to Register
  switchContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  switchText: {
    color: C.slate500,
    fontSize: 13,
    fontWeight: "500",
  },
  switchLink: {
    color: C.teal600,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  footer: {
    textAlign: "center",
    color: C.slate400,
    fontSize: 11,
    marginTop: 20,
    lineHeight: 16,
  },
});
