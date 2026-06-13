# Deploying `apps/web` to Vercel

1. Project setup
- On Vercel, create a new project and set the **Root Directory** to `apps/web`.
- Framework: Next.js. Vercel will detect automatically with `next` dependency.

2. Build & Install commands
- Install Command: `pnpm install`
- Build Command: `pnpm build` (the project's `apps/web/vercel.json` already sets this)

3. Node & PNPM
- Ensure Node version >= 20 and PNPM >= 9. Either set in project settings or rely on `engines` in `apps/web/package.json`.

4. Environment variables
Add the following environment variables in Vercel (use the Values from your secrets):
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_DSN`
- `RESEND_API_KEY`

5. Database migrations
- Do NOT run migrations during Vercel build. Run them separately before or after deploying using your CI or manually:

```
pnpm --filter web db:migrate:prod
```

6. Optional local build check
From repo root:

```
pnpm install
pnpm --filter web build
pnpm --filter web start
```

Or from `apps/web`:

```
cd apps/web
pnpm install
pnpm build
pnpm start
```

7. Notes
- Keep secrets out of source control. Use Vercel Environment Variables or Secret Store.
- The repository includes `.env.example` in `apps/web` with placeholders; use it to prepare local `.env.local`.
