import React, { useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
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
import { useAuth } from "../context/AuthContext";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  teal700: "#0b3b47",
  teal600: "#0f8b8d",
  teal200: "#8bd8d2",
  teal100: "#c8f1ec",
  teal50: "#eefbf8",
  tealBorder: "#6fd6ca",
  slate900: "#10202b",
  slate700: "#344955",
  slate500: "#6f7f87",
  slate400: "#9aa7ad",
  slate200: "#dde5e8",
  slate100: "#edf2f3",
  slate50: "#fbf7ef",
  ink: "#081a24",
  gold100: "#f7df9e",
  gold600: "#a86f16",
  white: "#ffffff",
  red500: "#ef4444",
  red700: "#b91c1c",
  red50: "#fef2f2",
  redBorder: "#fca5a5",
};

const DISPLAY_FONT = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: undefined,
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LoginScreen({
  onSwitchToRegister,
}: {
  onSwitchToRegister: () => void;
}) {
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
    <SafeAreaView edges={["top", "left", "right"]} style={s.root}>
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
            <ImageBackground
              source={require("../../assets/travel-editorial-hero.png")}
              resizeMode="cover"
              style={s.heroImage}
              imageStyle={s.heroImageInner}
            >
              <View style={s.heroImageScrim} />
            </ImageBackground>
            <Text style={s.heroKicker}>Travel atelier</Text>
            <Text style={s.heroHeading}>Welcome{"\n"}back</Text>
            <Text style={s.heroSub}>
              Return to your private studio for refined itineraries, saved
              ideas, and polished escapes.
            </Text>
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
              <TouchableOpacity onPress={onSwitchToRegister}>
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
  root: { flex: 1, backgroundColor: C.slate50 },

  // Hero
  hero: {
    backgroundColor: C.ink,
    borderRadius: 28,
    marginHorizontal: 18,
    marginTop: 16,
    minHeight: 302,
    overflow: "hidden",
    paddingHorizontal: 28,
    paddingTop: 42,
    paddingBottom: 34,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
  },
  heroImage: {
    bottom: 0,
    left: 0,
    opacity: 0.74,
    position: "absolute",
    right: 0,
    top: 0,
  },
  heroImageInner: {
    transform: [{ scale: 1.08 }],
  },
  heroImageScrim: {
    backgroundColor: "rgba(8, 26, 36, 0.48)",
    flex: 1,
  },
  heroKicker: {
    color: C.gold100,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: "uppercase",
    marginTop: 28,
  },

  heroHeading: {
    fontFamily: DISPLAY_FONT,
    fontSize: 38,
    fontWeight: "700",
    color: C.white,
    lineHeight: 43,
    marginBottom: 14,
  },
  heroSub: {
    fontSize: 14,
    color: C.slate200,
    lineHeight: 21,
    maxWidth: 310,
  },

  // Card
  card: {
    backgroundColor: C.white,
    borderColor: "rgba(168,111,22,0.12)",
    borderRadius: 24,
    borderWidth: 1,
    marginHorizontal: 18,
    marginTop: 18,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 48,
    marginBottom: 28,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
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
    backgroundColor: "rgba(255,255,255,0.92)",
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
    backgroundColor: C.white,
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
    fontWeight: "800",
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
