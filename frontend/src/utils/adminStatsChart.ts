import type { AdminStats } from "../services/api";

export type AdminUsageMetric = {
  key: keyof AdminStats;
  label: string;
  value: number;
  formattedValue: string;
};

export function formatAdminStatValue(key: keyof AdminStats, value: number) {
  if (key === "p95_latency_ms") {
    return `${Math.round(value)} ms`;
  }

  return `${Math.round(value)}`;
}

export function buildAdminUsageMetrics(stats: AdminStats): AdminUsageMetric[] {
  return [
    {
      key: "total_requests",
      label: "Total requests",
      value: stats.total_requests,
      formattedValue: formatAdminStatValue("total_requests", stats.total_requests),
    },
    {
      key: "active_requests",
      label: "Active requests",
      value: stats.active_requests,
      formattedValue: formatAdminStatValue("active_requests", stats.active_requests),
    },
    {
      key: "p95_latency_ms",
      label: "P95 latency",
      value: stats.p95_latency_ms,
      formattedValue: formatAdminStatValue("p95_latency_ms", stats.p95_latency_ms),
    },
    {
      key: "error_count",
      label: "Errors",
      value: stats.error_count,
      formattedValue: formatAdminStatValue("error_count", stats.error_count),
    },
  ];
}

export function getUsageMetricPercent(value: number, maxValue: number) {
  if (maxValue <= 0 || value <= 0) {
    return 0;
  }

  return Math.max(6, Math.min(100, (value / maxValue) * 100));
}
