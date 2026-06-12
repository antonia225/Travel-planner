import React, { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppCard from "../components/AppCard";
import PrimaryButton from "../components/PrimaryButton";
import { colors, radius, shadows, spacing } from "../theme/designSystem";
import { getAdminStats, AdminStats, canAccessAdmin } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function AdminStatsScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStats({ total_requests: 0, active_requests: 0, p95_latency_ms: 0, error_count: 0 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canAccessAdmin(user)) return;
    fetchStats();
    const id = setInterval(fetchStats, 10_000);
    return () => clearInterval(id);
  }, [fetchStats, user]);

  if (!canAccessAdmin(user)) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <Text style={styles.title}>Access restricted</Text>
          <Text style={styles.subtitle}>You need admin permissions to view this screen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <AppCard elevated>
          <Text style={styles.header}>Usage statistics</Text>

          {isLoading && !stats ? (
            <ActivityIndicator size="large" color={colors.teal600} />
          ) : null}

          <View style={styles.grid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{stats ? stats.total_requests : "-"}</Text>
              <Text style={styles.metricLabel}>Total requests</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{stats ? stats.active_requests : "-"}</Text>
              <Text style={styles.metricLabel}>Active requests</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{stats ? stats.p95_latency_ms : "-"}</Text>
              <Text style={styles.metricLabel}>P95 latency (ms)</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{stats ? stats.error_count : "-"}</Text>
              <Text style={styles.metricLabel}>Error count</Text>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton title="Refresh" onPress={fetchStats} style={styles.refresh} />
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.slate900, flex: 1 },
  container: { padding: spacing.lg },
  header: { fontSize: 20, fontWeight: "800", marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metricCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate100,
    padding: spacing.md,
    width: "48%",
    marginBottom: spacing.md,
  },
  metricValue: { fontSize: 20, fontWeight: "800", color: colors.slate900 },
  metricLabel: { fontSize: 12, fontWeight: "700", color: colors.slate500, marginTop: 6 },
  errorText: { color: colors.red700, marginTop: spacing.sm },
  refresh: { marginTop: spacing.md },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { color: colors.white, fontSize: 22, fontWeight: "800" },
  subtitle: { color: colors.slate300, marginTop: spacing.sm },
});
