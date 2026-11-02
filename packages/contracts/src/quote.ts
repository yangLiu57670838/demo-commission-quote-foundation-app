import { z } from "zod";

/**
 * Money on the wire is a decimal string, not a JSON number. Due to javascript limit.
 */
export const DEMO_MAX_LOAN_AMOUNT = "10000000";
/** Assumption: 360 months is a 30-year demo cap, not a vendor rule. */
export const DEMO_MAX_LOAN_TERM_MONTHS = 360;
/** Assumption: a commission rate above 100% of the loan is out of scope for the demo. */
export const DEMO_MAX_COMMISSION_RATE = "1";
/** Assumption: total commission cannot exceed the demo maximum loan amount. */
export const DEMO_MAX_TOTAL_COMMISSION = DEMO_MAX_LOAN_AMOUNT;

export const RISK_BANDS = ["LOW", "MEDIUM", "HIGH"] as const;

const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;
const MAX_DECIMAL_LENGTH = 100;

type DecimalParts = {
  negative: boolean;
  whole: string;
  fraction: string;
};

function parseDecimal(value: string): DecimalParts | undefined {
  if (value.length === 0 || value.length > MAX_DECIMAL_LENGTH) {
    return undefined;
  }

  const match = DECIMAL_PATTERN.exec(value);
  const sign = match?.[1];
  const whole = match?.[2];
  const fraction = match?.[3] ?? "";
  if (sign === undefined || whole === undefined) {
    return undefined;
  }
  if (whole.length > 1 && whole.startsWith("0")) {
    return undefined;
  }

  return {
    negative: sign === "-", // catch negative numbers and throw particular err later
    whole,
    fraction,
  };
}

// check if the number is 0.0000 or 0
function isZero(parts: DecimalParts): boolean {
  return /^0+$/.test(parts.whole) && /^0*$/.test(parts.fraction);
}

// return 1 if left is greater than right, -1 if left is less than right, 0 if they are equal
function compareInteger(left: string, right: string): number {
  // remove leading zeros from the whole parts
  const normalizedLeft = left.replace(/^0+/, "") || "0";
  const normalizedRight = right.replace(/^0+/, "") || "0";
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length > normalizedRight.length ? 1 : -1;
  }
  if (normalizedLeft === normalizedRight) {
    return 0;
  }
  // compare same length whole numbers when they are not equal
  return normalizedLeft > normalizedRight ? 1 : -1;
}

function comparePositive(left: DecimalParts, right: DecimalParts): number {
  const wholeOrder = compareInteger(left.whole, right.whole);
  if (wholeOrder !== 0) {
    return wholeOrder;
  }

  const width = Math.max(left.fraction.length, right.fraction.length);
  const leftFraction = left.fraction.padEnd(width, "0");
  const rightFraction = right.fraction.padEnd(width, "0");
  if (leftFraction === rightFraction) {
    return 0;
  }
  return leftFraction > rightFraction ? 1 : -1;
}

function positiveDecimalSchema(label: string, maximum: string) {
  const maximumParts = parseDecimal(maximum);
  // just in case the maximum is not a positive decimal later
  if (!maximumParts || maximumParts.negative || isZero(maximumParts)) {
    throw new Error(`maximum for ${label} must be a positive decimal`);
  }

  return z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? `${label} is required`
          : `${label} must be a decimal string`,
    })
    .trim()
    .superRefine((value, ctx) => {
      if (value.length === 0) {
        ctx.addIssue(`${label} is required`);
        return;
      }

      const parts = parseDecimal(value);
      if (!parts) {
        ctx.addIssue(`${label} must be a finite number`);
        return;
      }
      if (parts.negative || isZero(parts)) {
        ctx.addIssue(`${label} must be greater than 0`);
        return;
      }
      if (comparePositive(parts, maximumParts) > 0) {
        ctx.addIssue(`${label} must be at most ${maximum}`);
      }
    });
}

function normalizeTerm(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  const wholeNumber = /^(-?)(0|[1-9]\d*)(?:\.0+)?$/.exec(trimmed);
  const sign = wholeNumber?.[1];
  const digits = wholeNumber?.[2];
  if (sign !== undefined && digits !== undefined) {
    if (digits.length > 15) {
      return value;
    }
    const parsed = Number(`${sign}${digits}`);
    return Number.isSafeInteger(parsed) ? parsed : value;
  }

  // A non-zero fraction is not a whole number. Do not pass it through Number():
  // for example, 1.00001 or 12.5 will be converted to 0.5, and fail in next int() check.
  if (/^-?(?:0|[1-9]\d*)\.\d+$/.test(trimmed)) {
    return 0.5;
  }

  return value;
}

const loanTermInMonthsSchema = z.preprocess(
  normalizeTerm,
  z
    .int("Loan term must be a whole number of months")
    .positive("Loan term must be greater than 0")
    .max(
      DEMO_MAX_LOAN_TERM_MONTHS,
      `Loan term must be at most ${DEMO_MAX_LOAN_TERM_MONTHS} months`,
    ),
);

export const riskBandSchema = z.enum(RISK_BANDS, "Risk band must be LOW, MEDIUM, or HIGH");

export const quoteRequestSchema = z.object({
  loanAmount: positiveDecimalSchema("Loan amount", DEMO_MAX_LOAN_AMOUNT),
  loanTermInMonths: loanTermInMonthsSchema,
  riskBand: riskBandSchema,
});

export const quoteResponseSchema = z.object({
  quoteId: z.string("Quote id is required").trim().min(1, "Quote id is required"),
  commissionRate: positiveDecimalSchema("Commission rate", DEMO_MAX_COMMISSION_RATE),
  totalCommission: positiveDecimalSchema("Total commission", DEMO_MAX_TOTAL_COMMISSION),
});

export type RiskBand = z.infer<typeof riskBandSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;
