# MindWell — Monorepo

This repository contains the `apps/web` Next.js application and supporting tooling used for MindWell.

## Contents
- `apps/web` — Next.js frontend and server routes
- `docs` — documentation

## Prerequisites
- Node.js >= 20
- pnpm >= 9
- PostgreSQL (for local development) or your production database
- Optional: `pnpm` installed globally for convenience

Install pnpm (if missing):

```powershell
npm install -g pnpm
```

## Quick start (local)
1. Clone the repo and install dependencies from the repo root:

```bash
git clone <repo-url>
cd prompt-war
pnpm install
```

2. Configure environment variables
- Copy `apps/web/.env.example` to `apps/web/.env.local` and fill values.

3. Prepare the database (local dev)

```bash
pnpm --filter web db:migrate
pnpm --filter web db:seed
```

4. Run the app

```bash
pnpm --filter web dev
# open http://localhost:3000
```

## Scripts
- From repo root (monorepo): `pnpm --filter web <script>` — runs scripts in `apps/web`.
- Common scripts (see `apps/web/package.json`):
  - `dev`, `build`, `start`, `lint`, `test`, `db:migrate`, `db:seed`, `typecheck`

## Build & Start
Build and run the production server locally from the repo root:

```bash
pnpm --filter web build
pnpm --filter web start
```

## Environment variables
Required env vars are declared in `apps/web/vercel.json` and `apps/web/.env.example`. At minimum set:
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`, `RESEND_API_KEY`

## Vercel Deployment
Recommended Vercel settings:
- **Root Directory**: `apps/web`
- **Framework**: Next.js (auto-detected)
- **Install Command**: `pnpm install`
- **Build Command**: `pnpm build`
- **Regions**: set as needed (the repo's `vercel.json` includes `bom1`)

Important:
- Do not run DB migrations during the Vercel build. The repository `vercel.json` has been updated to avoid running migrations at build time. Run migrations separately using CI or a one-off run:

```bash
pnpm --filter web db:migrate:prod
```

- Add the environment variables listed above in the Vercel Dashboard (use Vercel Secrets).

## CI / Recommended workflow
- Create a CI job that:
  1. Installs dependencies: `pnpm install`
  2. Runs typechecking & tests: `pnpm --filter web typecheck && pnpm --filter web test`
  3. Builds the app: `pnpm --filter web build`
  4. Optionally runs migrations for production-only deploy jobs: `pnpm --filter web db:migrate:prod`

Example GitHub Actions step (snippet):

```yaml
# jobs.deploy.steps:
- name: Install pnpm
  run: npm install -g pnpm
- name: Install deps
  run: pnpm install
- name: Build web
  run: pnpm --filter web build
```

## Migrations
- Use `prisma migrate` commands from `apps/web` via the monorepo filter:

```bash
pnpm --filter web db:migrate
pnpm --filter web db:migrate:prod
pnpm --filter web db:seed
```

## Testing
- Unit & integration tests: `pnpm --filter web test`
- E2E tests: `pnpm --filter web test:e2e`

## Troubleshooting
- If builds fail on CI or Vercel, verify Node version and `pnpm` availability. Ensure environment variables are set and database is reachable for any migration steps.
- If `pnpm` is not available on a machine, install it globally as shown above.

## Files to review
- Vercel config: [apps/web/vercel.json](apps/web/vercel.json)
- Next config: [apps/web/next.config.ts](apps/web/next.config.ts)
- Web package.json: [apps/web/package.json](apps/web/package.json)

---
If you'd like, I can also:
- Add a GitHub Actions workflow to build & test on push
- Add a one-shot script to run migrations via CI
- Run a local build here (requires `pnpm` installed in this environment)

