import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
} from "lucide-react-native";

import { useAuth } from "../context/AuthContext";
import {
  AdminAIAgentMetrics,
  AdminStats,
  canAccessAdmin,
  getAdminAIAgentMetrics,
  getAdminStats,
} from "../services/api";
import { colors, radius, shadows, spacing } from "../theme/designSystem";
import {
  buildAIAgentPerformanceMetrics,
  buildAdminUsageMetrics,
  COLLAPSED_AI_LOG_COUNT,
  formatAgentResponseTime,
  getVisibleAIAgentLogs,
} from "../utils/adminStatsChart";

type Props = {
  navigation: {
    goBack: () => void;
  };
};

export default function AdminStatsScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [agentMetrics, setAgentMetrics] =
    useState<AdminAIAgentMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!token) {
      setError("You need to sign in again to view AI agent performance.");
      setStats(null);
      setAgentMetrics(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [systemStats, aiMetrics] = await Promise.all([
        getAdminStats(token),
        getAdminAIAgentMetrics(token),
      ]);
      setStats(systemStats);
      setAgentMetrics(aiMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStats(null);
      setAgentMetrics(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !canAccessAdmin(user)) {
      return;
    }

    fetchStats();
    const id = setInterval(fetchStats, 10_000);
    return () => clearInterval(id);
  }, [fetchStats, token, user]);

  if (!canAccessAdmin(user)) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <Text style={styles.title}>Access restricted</Text>
          <Text style={styles.subtitle}>
            You need admin permissions to view this screen.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const aiPerformanceMetrics = agentMetrics
    ? buildAIAgentPerformanceMetrics(agentMetrics)
    : [];
  const systemMetrics = stats ? buildAdminUsageMetrics(stats) : [];
  const hasFailedGenerations =
    (agentMetrics?.summary.recent_failure_count ?? 0) > 0;
  const showInitialLoading = isLoading && !agentMetrics && !stats;
  const logs = agentMetrics?.logs ?? [];
  const visibleLogs = getVisibleAIAgentLogs(logs, showAllLogs);
  const hasHiddenLogs = logs.length > COLLAPSED_AI_LOG_COUNT;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconButton}
          activeOpacity={0.8}
          onPress={navigation.goBack}
        >
          <ArrowLeft color={colors.white} size={22} strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.topCopy}>
          <Text style={styles.topKicker}>Admin dashboard</Text>
          <Text style={styles.topTitle}>AI Agent Performance</Text>
          <Text style={styles.topSubtitle}>
            Model timing, failed generations, and backend health
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.iconButton, isLoading ? styles.iconButtonDisabled : null]}
          activeOpacity={0.8}
          disabled={isLoading}
          onPress={fetchStats}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <RefreshCw color={colors.white} size={20} strokeWidth={2.4} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorPanel}>
            <AlertTriangle color={colors.red700} size={18} strokeWidth={2.4} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {showInitialLoading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="large" color={colors.teal600} />
            <Text style={styles.loadingText}>Loading AI performance data...</Text>
          </View>
        ) : null}

        <View style={styles.sectionSurface}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>Local model timing</Text>
              <Text style={styles.sectionTitle}>Agent response times</Text>
            </View>

            {agentMetrics ? (
              <View
                style={[
                  styles.failureBadge,
                  hasFailedGenerations ? styles.failureBadgeActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.failureBadgeText,
                    hasFailedGenerations ? styles.failureBadgeTextActive : null,
                  ]}
                >
                  {agentMetrics.summary.recent_failure_count} failed
                </Text>
              </View>
            ) : null}
          </View>

          {agentMetrics ? (
            <View style={styles.agentMetricGrid}>
              {aiPerformanceMetrics.map((metric) => (
                <View key={metric.key} style={styles.agentMetricTile}>
                  <Text style={styles.agentMetricValue}>
                    {metric.formattedValue}
                  </Text>
                  <Text style={styles.agentMetricLabel}>{metric.label}</Text>
                  <Text style={styles.agentMetricHint}>
                    {metric.key === "itinerary_agent_response_time_ms"
                      ? "Trip generation"
                      : "Budget optimization"}
                  </Text>
                </View>
              ))}
            </View>
          ) : !showInitialLoading ? (
            <Text style={styles.emptyText}>No AI agent data available yet.</Text>
          ) : null}

          {agentMetrics ? (
            hasFailedGenerations ? (
              <View style={styles.alertPanel}>
                <View style={styles.inlineHeader}>
                  <AlertTriangle
                    color={colors.red700}
                    size={18}
                    strokeWidth={2.4}
                  />
                  <Text style={styles.alertTitle}>Failed AI generations</Text>
                </View>

                {agentMetrics.alerts.map((alert) => (
                  <View key={alert.id} style={styles.alertRow}>
                    <Text style={styles.alertAgent}>{alert.agent_name}</Text>
                    <Text style={styles.alertMessage}>{alert.message}</Text>
                    <Text style={styles.alertMeta}>
                      {formatOperation(alert.operation)} -{" "}
                      {formatTimestamp(alert.created_at)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.successPanel}>
                <CheckCircle2
                  color={colors.teal700}
                  size={18}
                  strokeWidth={2.4}
                />
                <Text style={styles.successText}>
                  No failed AI generations in recent logs.
                </Text>
              </View>
            )
          ) : null}
        </View>

        <View style={styles.sectionSurface}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>Activity log</Text>
              <Text style={styles.sectionTitle}>Recent generations</Text>
            </View>
          </View>

          {logs.length ? (
            <View style={styles.logList}>
              {visibleLogs.map((log) => (
                <View key={log.id} style={styles.logRow}>
                  <View style={styles.logHeader}>
                    <View style={styles.logCopy}>
                      <Text style={styles.logLabel}>{log.metric_label}</Text>
                      <Text style={styles.logMeta}>
                        {formatOperation(log.operation)}
                        {log.destination ? ` - ${log.destination}` : ""}
                        {log.model ? ` - ${log.model}` : ""}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        log.status === "failed"
                          ? styles.statusPillFailed
                          : styles.statusPillSuccess,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          log.status === "failed"
                            ? styles.statusPillTextFailed
                            : styles.statusPillTextSuccess,
                        ]}
                      >
                        {log.fallback_used ? "Fallback" : log.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.logFooter}>
                    <Text style={styles.logTime}>
                      {formatAgentResponseTime(log.response_time_ms)}
                    </Text>
                    <Text style={styles.logDate}>
                      {formatTimestamp(log.created_at)}
                    </Text>
                  </View>

                  {log.error_message ? (
                    <Text style={styles.logError}>{log.error_message}</Text>
                  ) : null}
                </View>
              ))}
              {hasHiddenLogs ? (
                <TouchableOpacity
                  style={styles.logToggleButton}
                  activeOpacity={0.82}
                  onPress={() => setShowAllLogs((current) => !current)}
                >
                  <Text style={styles.logToggleText}>
                    {showAllLogs
                      ? "Show only latest 3"
                      : `Show all ${logs.length} logs`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : !showInitialLoading ? (
            <Text style={styles.emptyText}>No AI generation logs recorded yet.</Text>
          ) : null}
        </View>

        <View style={styles.systemSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>Backend health</Text>
              <Text style={styles.sectionTitle}>System health</Text>
            </View>
          </View>

          {stats ? (
            <View style={styles.systemGrid}>
              {systemMetrics.map((metric) => (
                <View key={metric.key} style={styles.systemMetricTile}>
                  <Text style={styles.systemMetricValue}>
                    {metric.formattedValue}
                  </Text>
                  <Text style={styles.systemMetricLabel}>{metric.label}</Text>
                </View>
              ))}
            </View>
          ) : !showInitialLoading ? (
            <Text style={styles.emptyText}>No system health data available.</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatOperation(operation: string) {
  if (operation === "generate_itinerary") {
    return "Generate itinerary";
  }
  if (operation === "optimize_budget") {
    return "Optimize budget";
  }
  return operation.replace(/_/g, " ");
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.slate900,
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  iconButtonDisabled: {
    opacity: 0.72,
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
  topSubtitle: {
    color: colors.slate300,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  scroll: {
    backgroundColor: colors.slate50,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    flex: 1,
  },
  container: {
    gap: spacing.lg,
    paddingBottom: 42,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  sectionSurface: {
    backgroundColor: colors.white,
    borderColor: colors.slate100,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadows.soft,
  },
  systemSection: {
    backgroundColor: colors.white,
    borderColor: colors.slate100,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionEyebrow: {
    color: colors.teal700,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 3,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: colors.slate900,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23,
  },
  agentMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  agentMetricTile: {
    backgroundColor: colors.slate50,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 118,
    minWidth: 148,
    padding: spacing.md,
    width: "47%",
  },
  agentMetricValue: {
    color: colors.slate900,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  agentMetricLabel: {
    color: colors.slate700,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  agentMetricHint: {
    color: colors.slate500,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 4,
  },
  failureBadge: {
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  failureBadgeActive: {
    backgroundColor: colors.red50,
    borderColor: colors.redBorder,
  },
  failureBadgeText: {
    color: colors.teal700,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  failureBadgeTextActive: {
    color: colors.red700,
  },
  inlineHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  alertPanel: {
    backgroundColor: colors.red50,
    borderColor: colors.redBorder,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  alertTitle: {
    color: colors.red700,
    fontSize: 14,
    fontWeight: "800",
  },
  alertRow: {
    borderTopColor: colors.redBorder,
    borderTopWidth: 1,
    gap: 2,
    paddingTop: spacing.sm,
  },
  alertAgent: {
    color: colors.red700,
    fontSize: 12,
    fontWeight: "800",
  },
  alertMessage: {
    color: colors.slate700,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  alertMeta: {
    color: colors.slate500,
    fontSize: 11,
    fontWeight: "700",
  },
  successPanel: {
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  successText: {
    color: colors.teal700,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  logList: {
    gap: spacing.sm,
  },
  logToggleButton: {
    alignItems: "center",
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  logToggleText: {
    color: colors.teal700,
    fontSize: 13,
    fontWeight: "800",
  },
  logRow: {
    backgroundColor: colors.slate50,
    borderColor: colors.slate100,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  logHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  logCopy: {
    flex: 1,
  },
  logLabel: {
    color: colors.slate900,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  logMeta: {
    color: colors.slate500,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusPillSuccess: {
    backgroundColor: colors.teal50,
    borderColor: colors.teal200,
  },
  statusPillFailed: {
    backgroundColor: colors.red50,
    borderColor: colors.redBorder,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  statusPillTextSuccess: {
    color: colors.teal700,
  },
  statusPillTextFailed: {
    color: colors.red700,
  },
  logFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  logTime: {
    color: colors.slate900,
    fontSize: 13,
    fontWeight: "800",
  },
  logDate: {
    color: colors.slate500,
    fontSize: 11,
    fontWeight: "700",
  },
  logError: {
    color: colors.red700,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  systemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  systemMetricTile: {
    backgroundColor: colors.slate50,
    borderColor: colors.slate100,
    borderRadius: radius.md,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 118,
    padding: spacing.md,
    width: "47%",
  },
  systemMetricValue: {
    color: colors.slate900,
    fontSize: 17,
    fontWeight: "800",
  },
  systemMetricLabel: {
    color: colors.slate500,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
    marginTop: 4,
    textTransform: "uppercase",
  },
  errorPanel: {
    alignItems: "center",
    backgroundColor: colors.red50,
    borderColor: colors.redBorder,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.red700,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  loadingPanel: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.slate100,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
    ...shadows.soft,
  },
  loadingText: {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.slate500,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: spacing.xxl,
  },
  title: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: colors.slate300,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
