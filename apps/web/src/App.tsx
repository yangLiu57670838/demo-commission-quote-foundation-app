import { Container, CssBaseline, Typography } from "@mui/material";
import { QuoteForm } from "./QuoteForm";

export function App() {
  return (
    <>
      <CssBaseline />
      <Container
        maxWidth="sm"
        sx={{ py: 4, width: "100%", maxWidth: "100%", overflowX: "clip" }}
      >
        <Typography variant="h1" sx={{ fontSize: "2rem", overflowWrap: "anywhere" }}>
          Commission quotes
        </Typography>
        <QuoteForm />
      </Container>
    </>
  );
}
