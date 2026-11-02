# Commission Quote

Local scaffold for the commission quote app.

## Run

```bash
pnpm install
pnpm dev
```

`pnpm dev` reads `.env.local`. Docker Compose injects `.env.dev`. Both files hold the demo placeholder key.

- Web: http://localhost:5173
- BFF GraphQL: http://localhost:4000/graphql
- Mock vendor health: http://localhost:4001/health

## Test

```bash
pnpm test
pnpm lint
pnpm typecheck
```

