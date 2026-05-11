import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
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
  slate900: "#0f172a",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  white: "#ffffff",
  red500: "#ef4444",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user, logout, isLoading } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={C.teal600} />
          <Text style={s.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.container}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.iconBadge}>
            <Text style={{ fontSize: 36 }}>✈️</Text>
          </View>
          <View style={s.headerContent}>
            <Text style={s.greeting}>Welcome back,</Text>
            <Text style={s.userName}>{user?.name || "Traveler"}</Text>
          </View>
        </View>

        {/* ── User Info Card ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Account Details</Text>

          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Name</Text>
            <Text style={s.infoValue}>{user?.name}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Email</Text>
            <Text style={s.infoValue}>{user?.email}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.infoRow}>
            <Text style={s.infoLabel}>User ID</Text>
            <Text style={[s.infoValue, s.infoValueMuted]}>{user?.id}</Text>
          </View>
        </View>

        {/* ── Features Placeholder ── */}
        <View style={s.featuresCard}>
          <Text style={s.cardTitle}>Features</Text>
          <View style={s.featureItem}>
            <Text style={s.featureIcon}>🗺️</Text>
            <Text style={s.featureText}>Plan your perfect trip</Text>
          </View>
          <View style={s.featureItem}>
            <Text style={s.featureIcon}>🤖</Text>
            <Text style={s.featureText}>AI-powered recommendations</Text>
          </View>
          <View style={s.featureItem}>
            <Text style={s.featureIcon}>📍</Text>
            <Text style={s.featureText}>Discover hidden gems</Text>
          </View>
        </View>

        <TouchableOpacity
          style={s.libraryButton}
          onPress={() => navigation.navigate("Library")}
          activeOpacity={0.85}
        >
          <Text style={s.libraryButtonText}>Saved Trips Library</Text>
        </TouchableOpacity>

        {/* ── Logout Button ── */}
        <TouchableOpacity
          style={s.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={s.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.teal700,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: C.slate500,
    fontSize: 14,
    fontWeight: "600",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
    gap: 16,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    color: C.teal100,
    fontSize: 14,
    fontWeight: "500",
  },
  userName: {
    color: C.white,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 4,
  },

  // Card
  card: {
    backgroundColor: C.slate50,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    color: C.slate900,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabel: {
    color: C.slate500,
    fontSize: 13,
    fontWeight: "600",
  },
  infoValue: {
    color: C.slate900,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  infoValueMuted: {
    color: C.slate400,
    fontSize: 12,
    fontFamily: "monospace",
  },
  divider: {
    height: 1,
    backgroundColor: C.slate200,
  },

  // Features Card
  featuresCard: {
    backgroundColor: C.slate50,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureText: {
    color: C.slate700,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },

  libraryButton: {
    backgroundColor: C.teal600,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  libraryButtonText: {
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
  },

  // Logout Button
  logoutButton: {
    backgroundColor: C.red500,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonText: {
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
