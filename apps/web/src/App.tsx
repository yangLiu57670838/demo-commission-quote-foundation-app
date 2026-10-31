import { Container, CssBaseline, Typography } from "@mui/material";

export function App() {
  return (
    <>
      <CssBaseline />
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Typography variant="h1" sx={{ fontSize: "2rem" }}>
          Commission quotes
        </Typography>
      </Container>
    </>
  );
}
