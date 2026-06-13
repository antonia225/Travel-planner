import { getAdminAIAgentMetrics, getAdminStats } from "../src/services/api";
import {
  buildAIAgentPerformanceMetrics,
  buildAdminUsageMetrics,
  formatAgentResponseTime,
  formatAdminStatValue,
} from "../src/utils/adminStatsChart";

describe("getAdminStats", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it("loads secondary system health metrics with the admin bearer token", async () => {
    const mock = {
      total_requests: 10,
      active_requests: 2,
      p95_latency_ms: 123.45,
      error_count: 1,
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mock) } as any)
    );

    const res = await getAdminStats("jwt-token");
    expect(res.total_requests).toBe(10);
    expect(res.p95_latency_ms).toBeCloseTo(123.45);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/stats"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-token",
        }),
      })
    );
  });

  it("throws on non-OK response", async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ detail: "no" }) } as any));

    await expect(getAdminStats("bad")).rejects.toThrow();
  });

  it("loads primary AI agent metrics and failed-generation alerts", async () => {
    const mock = {
      summary: {
        itinerary_agent_response_time_ms: 125,
        budget_optimizer_agent_response_time_ms: 88,
        recent_failure_count: 1,
      },
      alerts: [
        {
          id: 1,
          agent_name: "Itinerary Agent",
          operation: "generate_itinerary",
          message: "invalid JSON",
          created_at: "2026-06-14T10:00:00",
        },
      ],
      logs: [
        {
          id: 1,
          agent_name: "Itinerary Agent",
          metric_label: "Itinerary Agent Response Time",
          operation: "generate_itinerary",
          destination: "Tokyo",
          model: "phi3",
          status: "failed",
          response_time_ms: 125,
          error_message: "invalid JSON",
          fallback_used: false,
          created_at: "2026-06-14T10:00:00",
        },
      ],
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mock) } as any)
    );

    const res = await getAdminAIAgentMetrics("jwt-token");

    expect(res.summary.recent_failure_count).toBe(1);
    expect(res.alerts[0].message).toBe("invalid JSON");
    expect(res.logs[0].metric_label).toBe("Itinerary Agent Response Time");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/ai-agent-metrics?limit=50"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-token",
        }),
      })
    );
  });

  it("builds compact secondary system health metrics", () => {
    const metrics = buildAdminUsageMetrics({
      total_requests: 10,
      active_requests: 2,
      p95_latency_ms: 123.45,
      error_count: 1,
    });

    expect(metrics.map((metric) => metric.key)).toEqual([
      "total_requests",
      "active_requests",
      "p95_latency_ms",
      "error_count",
    ]);
    expect(metrics.map((metric) => metric.label)).toEqual([
      "Requests",
      "Active now",
      "P95 latency",
      "Errors",
    ]);
    expect(metrics[2].formattedValue).toBe("123 ms");
  });

  it("formats latency with milliseconds", () => {
    expect(formatAdminStatValue("p95_latency_ms", 87.6)).toBe("88 ms");
    expect(formatAdminStatValue("error_count", 3)).toBe("3");
  });

  it("builds descriptive AI agent response-time labels", () => {
    const metrics = buildAIAgentPerformanceMetrics({
      summary: {
        itinerary_agent_response_time_ms: 125,
        budget_optimizer_agent_response_time_ms: 88,
        recent_failure_count: 0,
      },
      alerts: [],
      logs: [],
    });

    expect(metrics.map((metric) => metric.label)).toEqual([
      "Itinerary Agent Response Time",
      "Budget Optimizer Agent Response Time",
    ]);
    expect(metrics.map((metric) => metric.formattedValue)).toEqual([
      "125 ms",
      "88 ms",
    ]);
    expect(formatAgentResponseTime(null)).toBe("-");
  });
});
