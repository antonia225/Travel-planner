import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import AppCard from "../components/AppCard";
import PrimaryButton from "../components/PrimaryButton";
import { colors, radius, shadows, spacing } from "../theme/designSystem";
import { getAdminStats, AdminStats, canAccessAdmin } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  buildAdminUsageMetrics,
  getUsageMetricPercent,
} from "../utils/adminStatsChart";

const chartColors: Record<keyof AdminStats, string> = {
  total_requests: colors.teal600,
  active_requests: colors.sky600,
  p95_latency_ms: colors.violet600,
  error_count: colors.red500,
};

type Props = {
  navigation: {
    goBack: () => void;
  };
};

export default function AdminStatsScreen({ navigation }: Props) {
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

  const usageMetrics = stats ? buildAdminUsageMetrics(stats) : [];
  const maxMetricValue = Math.max(
    1,
    ...usageMetrics.map((metric) => metric.value)
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.8}
          onPress={navigation.goBack}
        >
          <ArrowLeft color={colors.white} size={22} strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={styles.topCopy}>
          <Text style={styles.topKicker}>Admin dashboard</Text>
          <Text style={styles.topTitle}>Usage statistics</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <AppCard elevated>
          <Text style={styles.header}>System usage</Text>

          {isLoading && !stats ? (
            <ActivityIndicator size="large" color={colors.teal600} />
          ) : null}

          {stats ? (
            <View style={styles.chartPanel}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>System usage chart</Text>
                <Text style={styles.chartCaption}>Live snapshot</Text>
              </View>

              {usageMetrics.map((metric) => {
                const percent = getUsageMetricPercent(
                  metric.value,
                  maxMetricValue
                );

                return (
                  <View key={metric.key} style={styles.chartRow}>
                    <View style={styles.chartLabelRow}>
                      <Text style={styles.chartLabel}>{metric.label}</Text>
                      <Text style={styles.chartValue}>
                        {metric.formattedValue}
                      </Text>
                    </View>
                    <View style={styles.chartTrack}>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            backgroundColor: chartColors[metric.key],
                            width: `${percent}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
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
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  topCopy: {
    flex: 1,
  },
  topKicker: {
    color: colors.slate300,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 3,
  },
  topTitle: {
    color: colors.white,
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
  },
  container: { padding: spacing.lg },
  header: { fontSize: 20, fontWeight: "800", marginBottom: spacing.md },
  chartPanel: {
    backgroundColor: colors.slate50,
    borderColor: colors.slate100,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  chartHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chartTitle: {
    color: colors.slate900,
    fontSize: 14,
    fontWeight: "800",
  },
  chartCaption: {
    color: colors.slate500,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  chartRow: {
    gap: spacing.xs,
  },
  chartLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chartLabel: {
    color: colors.slate700,
    fontSize: 12,
    fontWeight: "800",
  },
  chartValue: {
    color: colors.slate500,
    fontSize: 12,
    fontWeight: "800",
  },
  chartTrack: {
    backgroundColor: colors.slate200,
    borderRadius: radius.pill,
    height: 12,
    overflow: "hidden",
  },
  chartBar: {
    borderRadius: radius.pill,
    height: "100%",
  },
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
