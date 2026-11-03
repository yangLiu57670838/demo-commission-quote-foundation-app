import { parseTraceparent, startTrace } from "./trace";

describe("startTrace", () => {
  it("keeps a valid incoming trace id and mints a new span id", () => {
    const trace = startTrace("00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01");

    expect(trace.traceId).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(trace.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(trace.spanId).not.toBe("bbbbbbbbbbbbbbbb");
    expect(trace.parentSpanId).toBe("bbbbbbbbbbbbbbbb");
  });

  it("starts a new trace when the header is missing or blank", () => {
    expect(parseTraceparent(undefined)).toBeUndefined();
    expect(parseTraceparent("not-a-trace")).toBeUndefined();
    const trace = startTrace(undefined);
    expect(trace.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(trace.spanId).toMatch(/^[0-9a-f]{16}$/);
  });
});
