export type VendorSimulation = "off" | "forced";

export type VendorAppConfig = {
  apiKey: string;
  failureRate: number;
  simulation: VendorSimulation;
  slowReplyMs: number;
  random: () => number;
};

/** About one call in five fails when the rate is left unset. */
export const DEFAULT_FAILURE_RATE = 0.2;

/**
 * Longer than the BFF's 2000ms vendor timeout, so a forced slow reply
 * makes the caller give up.
 */
export const SLOW_REPLY_MS = 3_000;

export type VendorConfigResult =
  | { ok: true; config: VendorAppConfig }
  | { ok: false; message: string };

export function readVendorConfig(env: Record<string, string | undefined>): VendorConfigResult {
  const apiKey = env.VENDOR_API_KEY;
  if (!apiKey) {
    return { ok: false, message: "Missing VENDOR_API_KEY" };
  }

  const rateText = env.VENDOR_FAILURE_RATE;
  const failureRate =
    rateText === undefined || rateText.trim() === "" ? DEFAULT_FAILURE_RATE : Number(rateText);
  if (!Number.isFinite(failureRate) || failureRate < 0 || failureRate > 1) {
    return { ok: false, message: "VENDOR_FAILURE_RATE must be a number from 0 to 1" };
  }

  return {
    ok: true,
    config: {
      apiKey,
      failureRate,
      simulation: env.VENDOR_SIMULATION === "forced" ? "forced" : "off",
      slowReplyMs: SLOW_REPLY_MS,
      random: Math.random,
    },
  };
}
