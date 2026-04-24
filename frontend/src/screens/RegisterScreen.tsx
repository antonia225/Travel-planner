import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BASE_URL } from "../services/api";

// ─── Password validation ──────────────────────────────────────────────────────

type PasswordRules = {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
};

function checkPassword(password: string): PasswordRules {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

function allRulesMet(rules: PasswordRules): boolean {
  return Object.values(rules).every(Boolean);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RuleRow({ met, label }: { met: boolean; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text
        className={`text-sm font-semibold ${met ? "text-green-600" : "text-red-500"}`}
      >
        {met ? "✓" : "✗"}
      </Text>
      <Text className={`text-sm ${met ? "text-green-600" : "text-red-500"}`}>
        {label}
      </Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hintsVisible, setHintsVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const passwordRules = checkPassword(password);
  const passwordValid = allRulesMet(passwordRules);
  const isFormValid =
    name.trim().length > 0 && email.trim().length > 0 && passwordValid;

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (!hintsVisible && text.length > 0) setHintsVisible(true);
  };

  const handleRegister = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 201) {
        setSuccessMessage(
          "Account created successfully! You can now log in."
        );
        setName("");
        setEmail("");
        setPassword("");
        setHintsVisible(false);
      } else if (response.status === 409) {
        setErrorMessage("An account with this email already exists.");
      } else {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(
          (data as { detail?: string })?.detail ??
            "Something went wrong. Please try again."
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-50"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center px-6 py-14">
          {/* ── Header ── */}
          <View className="mb-10">
            <Text className="text-4xl font-bold text-slate-900 tracking-tight">
              Create Account
            </Text>
            <Text className="mt-2 text-base text-slate-500">
              Join AI Travel Planner today
            </Text>
          </View>

          {/* ── Error banner ── */}
          {errorMessage !== "" && (
            <View className="mb-5 flex-row items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <Text className="text-red-500 font-bold">!</Text>
              <Text className="flex-1 text-sm font-medium text-red-600">
                {errorMessage}
              </Text>
            </View>
          )}

          {/* ── Success banner ── */}
          {successMessage !== "" && (
            <View className="mb-5 flex-row items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <Text className="text-green-500 font-bold">✓</Text>
              <Text className="flex-1 text-sm font-medium text-green-700">
                {successMessage}
              </Text>
            </View>
          )}

          {/* ── Form fields ── */}
          <View className="gap-5">
            {/* Name */}
            <View>
              <Text className="mb-1.5 text-sm font-semibold text-slate-700">
                Full Name
              </Text>
              <TextInput
                className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900"
                placeholder="Jane Doe"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Email */}
            <View>
              <Text className="mb-1.5 text-sm font-semibold text-slate-700">
                Email
              </Text>
              <TextInput
                className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900"
                placeholder="jane@example.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <View>
              <Text className="mb-1.5 text-sm font-semibold text-slate-700">
                Password
              </Text>
              <TextInput
                className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900"
                placeholder="Create a strong password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />

              {/* Real-time password strength hints */}
              {hintsVisible && (
                <View className="mt-3 gap-1.5 rounded-xl border border-slate-100 bg-white p-3">
                  <RuleRow
                    met={passwordRules.minLength}
                    label="At least 8 characters"
                  />
                  <RuleRow
                    met={passwordRules.hasUppercase}
                    label="At least 1 uppercase letter (A–Z)"
                  />
                  <RuleRow
                    met={passwordRules.hasLowercase}
                    label="At least 1 lowercase letter (a–z)"
                  />
                  <RuleRow
                    met={passwordRules.hasNumber}
                    label="At least 1 number (0–9)"
                  />
                </View>
              )}
            </View>
          </View>

          {/* ── Submit button ── */}
          <TouchableOpacity
            className={`mt-8 items-center rounded-xl py-4 ${
              isFormValid && !isLoading ? "bg-sky-600" : "bg-slate-200"
            }`}
            onPress={handleRegister}
            disabled={!isFormValid || isLoading}
            activeOpacity={0.85}
          >
            <Text
              className={`text-base font-semibold ${
                isFormValid && !isLoading ? "text-white" : "text-slate-400"
              }`}
            >
              {isLoading ? "Creating account…" : "Create Account"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
