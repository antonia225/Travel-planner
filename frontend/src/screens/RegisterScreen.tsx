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
import { checkPassword, allRulesMet } from "../utils/validation";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  teal700:   "#0b3b47",
  teal600:   "#0f8b8d",
  teal200:   "#8bd8d2",
  teal100:   "#c8f1ec",
  teal50:    "#eefbf8",
  tealBorder:"#6fd6ca",
  slate900:  "#10202b",
  slate700:  "#344955",
  slate500:  "#6f7f87",
  slate400:  "#9aa7ad",
  slate200:  "#dde5e8",
  slate100:  "#edf2f3",
  slate50:   "#fbf7ef",
  ink:        "#081a24",
  gold100:   "#f7df9e",
  gold600:   "#a86f16",
  white:     "#ffffff",
  red500:    "#ef4444",
  red700:    "#b91c1c",
  red50:     "#fef2f2",
  redBorder: "#fca5a5",
};

const DISPLAY_FONT = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: undefined,
});

// ─── Rule row ─────────────────────────────────────────────────────────────────

function RuleRow({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={s.ruleRow}>
      <View style={[s.ruleDot, { backgroundColor: met ? C.teal600 : C.red50 }]}>
        <Text style={[s.ruleDotText, { color: met ? C.white : C.red500 }]}>
          {met ? "✓" : "✗"}
        </Text>
      </View>
      <Text style={[s.ruleLabel, { color: met ? C.teal700 : C.red500 }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RegisterScreen({
  onSwitchToLogin,
}: {
  onSwitchToLogin: () => void;
}) {
  const { register } = useAuth();

  const [name,           setName]           = useState("");
  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [hintsVisible,   setHintsVisible]   = useState(false);
  const [errorMessage,   setErrorMessage]   = useState("");
  const [isFormLoading,  setIsFormLoading]  = useState(false);

  const [nameFocused,     setNameFocused]     = useState(false);
  const [emailFocused,    setEmailFocused]    = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const passwordRules = checkPassword(password);
  const passwordValid = allRulesMet(passwordRules);
  const isFormValid   = name.trim().length > 0 && email.trim().length > 0 && passwordValid;

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (!hintsVisible && text.length > 0) setHintsVisible(true);
  };

  const handleRegister = async () => {
    setErrorMessage("");
    setIsFormLoading(true);

    try {
      await register(name.trim(), email.trim(), password);
      // Auto-navigate on success is handled by App.tsx
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Registration failed. Please try again.";
      setErrorMessage(errorMsg);
    } finally {
      setIsFormLoading(false);
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

            <Text style={s.heroKicker}>Private trip studio</Text>
            <Text style={s.heroHeading}>Join the{"\n"}journey</Text>
            <Text style={s.heroSub}>
              Create a private space for curated journeys, refined budgets,
              and memorable stays.
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

            {/* ── Full Name ── */}
            <Text style={s.label}>Full Name</Text>
            <TextInput
              style={[s.input, nameFocused && s.inputFocused]}
              placeholder="Jane Doe"
              placeholderTextColor={C.slate400}
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
            />

            {/* ── Email ── */}
            <Text style={s.label}>Email Address</Text>
            <TextInput
              style={[s.input, emailFocused && s.inputFocused]}
              placeholder="jane@example.com"
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

            {/* ── Password strength (shown ABOVE the input so keyboard doesn't hide it) ── */}
            {hintsVisible && (
              <View style={s.strengthCard}>
                <Text style={s.strengthTitle}>Password strength</Text>
                <RuleRow met={passwordRules.minLength}    label="At least 8 characters" />
                <RuleRow met={passwordRules.hasUppercase} label="One uppercase letter (A–Z)" />
                <RuleRow met={passwordRules.hasLowercase} label="One lowercase letter (a–z)" />
                <RuleRow met={passwordRules.hasNumber}    label="One number (0–9)" />
              </View>
            )}

            {/* ── Password ── */}
            <Text style={s.label}>Password</Text>
            <TextInput
              style={[s.input, passwordFocused && s.inputFocused, { marginBottom: 28 }]}
              placeholder="Create a strong password"
              placeholderTextColor={C.slate400}
              value={password}
              onChangeText={handlePasswordChange}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />

            {/* ── Submit ── */}
            <TouchableOpacity
              style={[s.button, !isFormValid || isFormLoading ? s.buttonDisabled : s.buttonActive]}
              onPress={handleRegister}
              disabled={!isFormValid || isFormLoading}
              activeOpacity={0.8}
            >
              {isFormLoading ? (
                <ActivityIndicator color={isFormValid ? C.white : C.slate400} />
              ) : (
                <Text style={[s.buttonText, !isFormValid && s.buttonTextDisabled]}>
                  Create Account
                </Text>
              )}
            </TouchableOpacity>

            {/* ── Switch to Login ── */}
            <View style={s.switchContainer}>
              <Text style={s.switchText}>Already have an account? </Text>
              <TouchableOpacity onPress={onSwitchToLogin}>
                <Text style={s.switchLink}>Sign in</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.footer}>
              By signing up you agree to our Terms &amp; Privacy Policy
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
  heroSub:     { fontSize: 14, color: C.slate200, lineHeight: 21, maxWidth: 310 },

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
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: C.red50, borderRadius: 14,
    borderWidth: 1, borderColor: C.redBorder,
    padding: 14, marginBottom: 20,
  },
  bannerSuccess: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: C.teal50, borderRadius: 14,
    borderWidth: 1, borderColor: C.tealBorder,
    padding: 14, marginBottom: 20,
  },
  bannerDotRed:  {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: C.red500, alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  bannerDotTeal: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: C.teal600, alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  bannerDotText:  { color: C.white, fontSize: 11, fontWeight: "700" },
  bannerTextRed:  { flex: 1, color: C.red700,   fontSize: 13, fontWeight: "500", lineHeight: 20 },
  bannerTextTeal: { flex: 1, color: C.teal700,  fontSize: 13, fontWeight: "500", lineHeight: 20 },

  // Inputs
  label: {
    color: C.slate500, fontSize: 11, fontWeight: "700",
    letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.92)", color: C.slate900,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.slate200,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, marginBottom: 20,
  },
  inputFocused: {
    borderColor: C.teal600,
    backgroundColor: C.white,
  },

  // Strength card
  strengthCard: {
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.slate100,
    padding: 16, marginBottom: 16,
  },
  strengthTitle: {
    color: C.slate500, fontSize: 10, fontWeight: "700",
    letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12,
  },

  // Rule rows
  ruleRow:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  ruleDot:     { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ruleDotText: { fontSize: 11, fontWeight: "700" },
  ruleLabel:   { fontSize: 13, fontWeight: "500" },

  // Button
  button:       {
    borderRadius: 14, paddingVertical: 16,
    alignItems: "center", justifyContent: "center",
  },
  buttonActive:   { backgroundColor: C.teal600 },
  buttonDisabled: { backgroundColor: C.slate200 },
  buttonText:         { color: C.white,     fontSize: 15, fontWeight: "800", letterSpacing: 0.4 },
  buttonTextDisabled: { color: C.slate400 },

  // Switch to Login
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
    textAlign: "center", color: C.slate400,
    fontSize: 11, marginTop: 20, lineHeight: 16,
  },
});
