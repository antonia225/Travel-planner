import { getAdminStats } from "../src/services/api";

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
});
