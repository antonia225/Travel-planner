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
import { BASE_URL } from "../services/api";
import { checkPassword, allRulesMet } from "../utils/validation";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  teal700:   "#0f766e",
  teal600:   "#0d9488",
  teal200:   "#99f6e4",
  teal100:   "#ccfbf1",
  teal50:    "#f0fdfa",
  tealBorder:"#5eead4",
  slate900:  "#0f172a",
  slate700:  "#334155",
  slate500:  "#64748b",
  slate400:  "#94a3b8",
  slate200:  "#e2e8f0",
  slate100:  "#f1f5f9",
  slate50:   "#f8fafc",
  white:     "#ffffff",
  red500:    "#ef4444",
  red700:    "#b91c1c",
  red50:     "#fef2f2",
  redBorder: "#fca5a5",
};

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

export default function RegisterScreen() {
  const [name,           setName]           = useState("");
  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [hintsVisible,   setHintsVisible]   = useState(false);
  const [errorMessage,   setErrorMessage]   = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading,      setIsLoading]      = useState(false);

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
    setSuccessMessage("");
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${BASE_URL}/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim(), email: email.trim(), password }),
        signal:  controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 201) {
        setSuccessMessage("Account created successfully! You can now log in.");
        setName(""); setEmail(""); setPassword(""); setHintsVisible(false);
      } else if (response.status === 409) {
        setErrorMessage("An account with this email already exists.");
      } else {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(
          (data as { detail?: string })?.detail ?? "Something went wrong. Please try again."
        );
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";
      setErrorMessage(
        isAbort
          ? "Request timed out. Make sure the backend is running and the IP in api.ts is correct."
          : "Could not reach the server. Check your network and the IP address in api.ts."
      );
    } finally {
      setIsLoading(false);
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

            {/* Top row: badge + tagline pill */}
            <View style={s.heroTopRow}>
              {/* App icon badge */}
              <View style={s.iconBadge}>
                <Text style={{ fontSize: 28 }}>✈️</Text>
              </View>
            </View>

            <Text style={s.heroHeading}>Join the{"\n"}Journey</Text>
            <Text style={s.heroSub}>
              Create your free account and start exploring the world
            </Text>

            {/* Decorative stat row */}
            <View style={s.statRow}>
              {[["🌍","50+ countries"],["📍","Custom trips"],["⭐","4.9 rating"]].map(
                ([icon, label]) => (
                  <View key={label} style={s.stat}>
                    <Text style={s.statIcon}>{icon}</Text>
                    <Text style={s.statLabel}>{label}</Text>
                  </View>
                )
              )}
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

            {/* Success banner */}
            {successMessage !== "" && (
              <View style={s.bannerSuccess}>
                <View style={s.bannerDotTeal}>
                  <Text style={s.bannerDotText}>✓</Text>
                </View>
                <Text style={s.bannerTextTeal}>{successMessage}</Text>
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
              style={[s.button, !isFormValid || isLoading ? s.buttonDisabled : s.buttonActive]}
              onPress={handleRegister}
              disabled={!isFormValid || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={isFormValid ? C.white : C.slate400} />
              ) : (
                <Text style={[s.buttonText, !isFormValid && s.buttonTextDisabled]}>
                  Create Account
                </Text>
              )}
            </TouchableOpacity>

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
  root: { flex: 1, backgroundColor: C.teal700 },

  // Hero
  hero: {
    backgroundColor: C.teal700,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 60,
  },
  heroTopRow:   { flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 12 },
  iconBadge:    {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  trustChip:    {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12, paddingVertical: 6,
  },
  trustChipText: { color: C.teal100, fontSize: 12, fontWeight: "600" },

  heroHeading: { fontSize: 40, fontWeight: "800", color: C.white, lineHeight: 46, marginBottom: 10 },
  heroSub:     { fontSize: 14, color: C.teal200, lineHeight: 20, marginBottom: 28 },

  statRow:  { flexDirection: "row", gap: 16 },
  stat:     {
    flex: 1, backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12, padding: 10, alignItems: "center",
  },
  statIcon:  { fontSize: 18, marginBottom: 4 },
  statLabel: { fontSize: 10, color: C.teal100, fontWeight: "600", textAlign: "center" },

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
    backgroundColor: C.white, color: C.slate900,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.slate200,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, marginBottom: 20,
  },
  inputFocused: {
    borderColor: C.teal600,
    backgroundColor: C.teal50,
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
  buttonText:         { color: C.white,     fontSize: 15, fontWeight: "700", letterSpacing: 0.4 },
  buttonTextDisabled: { color: C.slate400 },

  footer: {
    textAlign: "center", color: C.slate400,
    fontSize: 11, marginTop: 20, lineHeight: 16,
  },
});
