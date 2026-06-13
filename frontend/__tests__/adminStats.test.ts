import { getAdminStats } from "../src/services/api";
import {
  buildAdminUsageMetrics,
  formatAdminStatValue,
  getUsageMetricPercent,
} from "../src/utils/adminStatsChart";

describe("getAdminStats", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it("parses successful response", async () => {
    const mock = {
      total_requests: 10,
      active_requests: 2,
      p95_latency_ms: 123.45,
      error_count: 1,
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mock) } as any)
    );

    const res = await getAdminStats("test-token");
    expect(res.total_requests).toBe(10);
    expect(res.p95_latency_ms).toBeCloseTo(123.45);
  });

  it("throws on non-OK response", async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ detail: "no" }) } as any));

    await expect(getAdminStats("bad")).rejects.toThrow();
  });

  it("builds chart metrics for the admin usage chart", () => {
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
    expect(metrics[2].formattedValue).toBe("123 ms");
  });

  it("normalizes chart bar width without dropping visible non-zero values", () => {
    expect(getUsageMetricPercent(0, 10)).toBe(0);
    expect(getUsageMetricPercent(1, 100)).toBe(6);
    expect(getUsageMetricPercent(50, 100)).toBe(50);
    expect(getUsageMetricPercent(120, 100)).toBe(100);
  });

  it("formats latency with milliseconds", () => {
    expect(formatAdminStatValue("p95_latency_ms", 87.6)).toBe("88 ms");
    expect(formatAdminStatValue("error_count", 3)).toBe("3");
  });
});
