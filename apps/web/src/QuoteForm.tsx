import {
  RISK_BANDS,
  quoteRequestSchema,
  type QuoteResponse,
} from "@commission-quote/contracts";
import { Box, Button, TextField, Typography } from "@mui/material";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { QUOTE_UNAVAILABLE_MESSAGE, generateCommissionQuote } from "./quoteClient";

type FieldName = "loanAmount" | "loanTermInMonths" | "riskBand";
type FieldErrors = Partial<Record<FieldName, string>>;
type Phase = "idle" | "loading" | "done" | "failed";

type QuoteIssue = {
  path: PropertyKey[];
  message: string;
};

const FIELD_NAMES: readonly FieldName[] = ["loanAmount", "loanTermInMonths", "riskBand"];

function isFieldName(value: PropertyKey): value is FieldName {
  return FIELD_NAMES.some((field) => field === value);
}

function fieldErrorsFromIssues(issues: readonly QuoteIssue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (field !== undefined && isFieldName(field) && errors[field] === undefined && issue.message.length > 0) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

function clearField(errors: FieldErrors, field: FieldName): FieldErrors {
  if (errors[field] === undefined) {
    return errors;
  }
  const next = { ...errors };
  delete next[field];
  return next;
}

function fieldErrorProps(id: string, error: string | undefined): {
  error: boolean;
  helperText: ReactNode;
  inputAria: { "aria-invalid": boolean; "aria-describedby"?: string };
} {
  if (error === undefined) {
    return {
      error: false,
      helperText: undefined,
      inputAria: { "aria-invalid": false },
    };
  }

  const errorId = `${id}-error`;
  return {
    error: true,
    helperText: <span id={errorId}>{error}</span>,
    inputAria: {
      "aria-invalid": true,
      "aria-describedby": errorId,
    },
  };
}

function QuoteDetails({ quote }: { quote: QuoteResponse }) {
  const rows = [
    ["Quote id", quote.quoteId],
    ["Commission rate", quote.commissionRate],
    ["Total commission", quote.totalCommission],
  ] as const;

  return (
    <Box component="dl" sx={{ m: 0 }}>
      {rows.map(([label, value]) => (
        <Box key={label} sx={{ mb: 1, minWidth: 0 }}>
          <Typography component="dt" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography component="dd" sx={{ m: 0, overflowWrap: "anywhere" }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function QuoteForm() {
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTermInMonths, setLoanTermInMonths] = useState("");
  const [riskBand, setRiskBand] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [requestError, setRequestError] = useState("");
  const inFlight = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) {
      return;
    }

    const parsed = quoteRequestSchema.safeParse({
      loanAmount,
      loanTermInMonths,
      riskBand,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromIssues(parsed.error.issues));
      return;
    }

    setFieldErrors({});
    setRequestError("");
    setQuote(null);
    setPhase("loading");
    inFlight.current = true;
    try {
      const nextQuote = await generateCommissionQuote(parsed.data);
      setQuote(nextQuote);
      setRequestError("");
      setPhase("done");
    } catch (error: unknown) {
      setQuote(null);
      setRequestError(error instanceof Error ? error.message : QUOTE_UNAVAILABLE_MESSAGE);
      setPhase("failed");
    } finally {
      inFlight.current = false;
    }
  }

  const amount = fieldErrorProps("loan-amount", fieldErrors.loanAmount);
  const term = fieldErrorProps("loan-term", fieldErrors.loanTermInMonths);
  const band = fieldErrorProps("risk-band", fieldErrors.riskBand);

  return (
    <Box
      component="form"
      noValidate
      onSubmit={onSubmit}
      aria-busy={phase === "loading"}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        mt: 3,
      }}
    >
      <TextField
        id="loan-amount"
        label="Loan amount"
        value={loanAmount}
        onChange={(event) => {
          setLoanAmount(event.target.value);
          setFieldErrors((current) => clearField(current, "loanAmount"));
        }}
        error={amount.error}
        helperText={amount.helperText}
        fullWidth
        slotProps={{
          htmlInput: {
            inputMode: "decimal",
            autoComplete: "off",
            ...amount.inputAria,
          },
        }}
      />
      <TextField
        id="loan-term"
        label="Loan term in months"
        value={loanTermInMonths}
        onChange={(event) => {
          setLoanTermInMonths(event.target.value);
          setFieldErrors((current) => clearField(current, "loanTermInMonths"));
        }}
        error={term.error}
        helperText={term.helperText}
        fullWidth
        slotProps={{
          htmlInput: {
            inputMode: "numeric",
            autoComplete: "off",
            ...term.inputAria,
          },
        }}
      />
      <TextField
        id="risk-band"
        select
        label="Risk band"
        value={riskBand}
        onChange={(event) => {
          setRiskBand(event.target.value);
          setFieldErrors((current) => clearField(current, "riskBand"));
        }}
        error={band.error}
        helperText={band.helperText}
        fullWidth
        slotProps={{
          select: { native: true },
          htmlInput: {
            ...band.inputAria,
          },
        }}
      >
        <option value="">Select a risk band</option>
        {RISK_BANDS.map((bandOption) => (
          <option key={bandOption} value={bandOption}>
            {bandOption}
          </option>
        ))}
      </TextField>
      <Button
        type="submit"
        variant="contained"
        disabled={phase === "loading"}
        sx={{ minHeight: 44, alignSelf: "stretch" }}
      >
        Generate Quote
      </Button>
      <Box id="quote-status" aria-live="polite" aria-atomic="true" sx={{ minWidth: 0 }}>
        {phase === "loading" ? <Typography>Generating quote…</Typography> : null}
        {phase === "failed" ? (
          <Typography sx={{ overflowWrap: "anywhere" }}>{requestError}</Typography>
        ) : null}
        {quote ? <QuoteDetails quote={quote} /> : null}
      </Box>
    </Box>
  );
}
