import { randomBytes } from "node:crypto";

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export type IncomingTrace = {
  traceId: string;
  parentSpanId: string;
};

export function newTraceId(): string {
  return randomBytes(16).toString("hex");
}

export function newSpanId(): string {
  return randomBytes(8).toString("hex");
}

export function parseTraceparent(value: string | undefined): IncomingTrace | undefined {
  if (value === undefined) {
    return undefined;
  }
  const match = TRACEPARENT.exec(value.trim().toLowerCase());
  const traceId = match?.[1];
  const parentSpanId = match?.[2];
  if (traceId === undefined || parentSpanId === undefined) {
    return undefined;
  }
  if (/^0+$/.test(traceId) || /^0+$/.test(parentSpanId)) {
    return undefined;
  }
  return { traceId, parentSpanId };
}

export function startTrace(header: string | undefined): {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
} {
  const incoming = parseTraceparent(header);
  return {
    traceId: incoming?.traceId ?? newTraceId(),
    spanId: newSpanId(),
    ...(incoming === undefined ? {} : { parentSpanId: incoming.parentSpanId }),
  };
}
