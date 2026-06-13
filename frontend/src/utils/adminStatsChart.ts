import type { AdminAIAgentMetrics, AdminStats } from "../services/api";

export type AdminUsageMetric = {
  key: keyof AdminStats;
  label: string;
  value: number;
  formattedValue: string;
};

export type AIAgentPerformanceMetric = {
  key:
    | "itinerary_agent_response_time_ms"
    | "budget_optimizer_agent_response_time_ms";
  label:
    | "Itinerary Agent Response Time"
    | "Budget Optimizer Agent Response Time";
  value: number | null;
  formattedValue: string;
};

export function formatAdminStatValue(key: keyof AdminStats, value: number) {
  if (key === "p95_latency_ms") {
    return `${Math.round(value)} ms`;
  }

  return `${Math.round(value)}`;
}

export function formatAgentResponseTime(value: number | null) {
  return value === null ? "-" : `${Math.round(value)} ms`;
}

export function buildAIAgentPerformanceMetrics(
  metrics: AdminAIAgentMetrics
): AIAgentPerformanceMetric[] {
  return [
    {
      key: "itinerary_agent_response_time_ms",
      label: "Itinerary Agent Response Time",
      value: metrics.summary.itinerary_agent_response_time_ms,
      formattedValue: formatAgentResponseTime(
        metrics.summary.itinerary_agent_response_time_ms
      ),
    },
    {
      key: "budget_optimizer_agent_response_time_ms",
      label: "Budget Optimizer Agent Response Time",
      value: metrics.summary.budget_optimizer_agent_response_time_ms,
      formattedValue: formatAgentResponseTime(
        metrics.summary.budget_optimizer_agent_response_time_ms
      ),
    },
  ];
}

export function buildAdminUsageMetrics(stats: AdminStats): AdminUsageMetric[] {
  return [
    {
      key: "total_requests",
      label: "Requests",
      value: stats.total_requests,
      formattedValue: formatAdminStatValue("total_requests", stats.total_requests),
    },
    {
      key: "active_requests",
      label: "Active now",
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
