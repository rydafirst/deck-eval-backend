# Deck Eval API

NestJS backend for the Deck Eval Platform: auth, roles, tasks, slide uploads, rubric templates, the rating queue, submissions, reviews, exports and the audit log. The web app is in the separate `deck-eval-web` repo.

Stack: NestJS 11, Prisma 7 (PostgreSQL, `pg` driver adapter), JWT in an httpOnly cookie, bcrypt, magic links via SMTP, S3-compatible storage (Cloudflare R2, MinIO, Supabase) or local disk, sharp for the 1600px web copies of slides.

## Run locally

```bash
docker compose up -d db mailpit     # Postgres on 5432, Mailpit inbox on http://localhost:8025
cp .env.example .env                # set AUTH_SECRET to a long random string
pnpm install                        # also runs prisma generate
pnpm prisma:deploy                  # applies prisma/migrations (use prisma:migrate after schema changes)
pnpm seed
pnpm dev                            # http://localhost:4000
```

Seeded logins: `admin@deckeval.local` / `admin12345`, `reviewer@deckeval.local`, `rater1@deckeval.local`, `rater2@deckeval.local` / `password123` (all set by the `SEED_*` variables). The seed adds the "Slides Eval" project, the default rubric from PRD 1.11, three tags and a published sample task with three responses.

With `EMAIL_SERVER` empty, magic links print to the console. With `STORAGE_DRIVER=local`, files are kept in `./storage` and served at `/files` through signed links that expire after an hour. For R2 set `STORAGE_DRIVER=s3` plus the `R2_*` variables. `docker compose up -d minio` gives a local S3 on :9000.

## Adding tasks from files

Admins can add a task by dropping in everything they have for it at **Tasks → New task from files**. PDFs and PowerPoint files are turned into slide images on the server, so it needs LibreOffice and Poppler. The Docker image already has both. On a Mac, run `brew install poppler` and `brew install --cask libreoffice` before trying it locally.

There are two modes. **Chat with AI** sends the files and your notes to Claude, which fills in the task and asks about anything unclear. It needs `ANTHROPIC_API_KEY`. **Smart import** needs no key: it sorts files by name (`response-a.pdf` becomes Response A) and you fill in the rest. Both save a draft task, never a published one.

## Talking to the web app

The web app proxies `/api/*` to this server, so `FILES_BASE_URL` defaults to `/api/files` and the session cookie stays first-party. Set `WEB_URL` to the web app's public URL: magic links and post-login redirects use it.

## Deploy to Railway

The repo includes `railway.json` and a `Dockerfile`. When the container starts, it runs `prisma migrate deploy` (the init migration is in `prisma/migrations`) and then starts the server. Railway checks `/health` to see that it's up.

1. Push this repo to GitHub. In Railway, create a project, choose **Deploy from GitHub repo** and pick it.
2. In the same project, add **Database → PostgreSQL**.
3. In the API service's **Variables**, set:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `AUTH_SECRET` | a long random string (`openssl rand -hex 32`) |
   | `WEB_URL` | your Vercel URL, e.g. `https://deck-eval.vercel.app` |
   | `COOKIE_SECURE` | `true` |
   | `EMAIL_SERVER` / `EMAIL_FROM` | SMTP for magic links (e.g. Resend or Brevo SMTP). Leave `EMAIL_SERVER` empty to print links to the logs instead |
   | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` | the logins the seed creates |
   | `ANTHROPIC_API_KEY` | optional, from console.anthropic.com. Turns on Chat with AI for new tasks |

   Don't set `PORT`. Railway sets it for you.
4. Storage. The container's disk is wiped on every deploy, so pick one:
   - **Cloudflare R2** (free up to 10 GB): `STORAGE_DRIVER=s3`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
   - **Railway volume**: add a volume to the service mounted at `/app/storage`, then set `STORAGE_DRIVER=local` and `LOCAL_STORAGE_DIR=/app/storage`.
5. Under **Settings → Networking**, choose **Generate Domain**. That URL is the `API_URL` for the web app on Vercel.
6. Seed once, from the Railway CLI on your laptop: `railway link`, then `railway ssh`, then `pnpm seed` inside the container. The seed also creates demo reviewer and rater accounts that use `SEED_USER_PASSWORD`. Deactivate them in Users if you don't want them.

## Run with Docker anywhere else

```bash
docker build -t deck-eval-api .
docker run --env-file .env -p 4000:4000 deck-eval-api
```

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test
```

## Layout

- `src/<module>/`: one Nest module per area (auth, tasks, templates, queue, submissions, reviews, exports, stats, users, tags, projects, storage, uploads, audit). Data access lives in repositories or Prisma calls in services, and request validation uses Zod.
- `src/shared/`: the rubric types and logic (validation, progress, independence check, natural sort). The web app keeps a copy in `lib/shared/`, so change both when you change one. The API's copy is the one that decides whether a submit is accepted.
- `prisma/schema.prisma`: the PRD 1.9 schema plus `Answer.scope`, `User.active`, `Task.openQueue`, `MagicLinkToken` and `Escalation`.

## Main routes

| Route | Who |
|---|---|
| `POST /auth/login`, `POST /auth/magic-link`, `GET /auth/magic`, `POST /auth/logout`, `GET /auth/me` | all |
| `GET /dashboard`, `POST /queue/next`, `POST /tasks/:id/claim`, `/unclaim`, `/escalate` | raters |
| `GET /tasks/:id/workspace`, `PUT /submissions/:id/answers`, `POST /submissions/:id/time`, `POST /submissions/:id/submit` | raters |
| `GET /reviews`, `GET /reviews/:submissionId`, `POST /reviews/:id/comments`, `POST /reviews/:id/verdict` | reviewers, admins |
| `/admin/intake/files`, `/admin/intake/chat`, `/admin/intake/tasks`, `/admin/intake/status` | admins |
| `/admin/tasks/*`, `/admin/templates/*`, `/admin/users`, `/admin/exports`, `/admin/stats`, `/admin/escalations`, `/admin/audit`, `/projects`, `/tags` | admins |
