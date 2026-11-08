# Qubit

Timed, proctored mock tests for JEE, NEET and other competitive exams.

| Part | Stack | Path |
|---|---|---|
| API + WebSockets | Spring Boot 4.1, Java 25, MySQL (Aiven) | `qubit-backend/` |
| Web app | Angular 21 (standalone, signals, zoneless) | `qubit-frontend/` |

## Run locally

```bash
# 1. backend — reads secrets from qubit-backend/.env (git-ignored; see .env.example)
cd qubit-backend && ./gradlew bootRun          # http://localhost:8080

# 2. frontend — proxies /api and /ws to :8080 (proxy.conf.json)
cd qubit-frontend && npm install && npm start  # http://localhost:4200
```

The superadmin account is created on startup from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`.

### Email

Set `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM` in `.env`
(Gmail: `smtp.gmail.com`, `587`, an App Password). Without `MAIL_HOST`, mails are not sent —
the verification link is printed to the backend log instead.

Mails sent: email verification (on register / resend), welcome (after verifying), hall ticket (on registration),
password reset (valid 1 hour, single use).

Auth endpoints are rate-limited per IP (e.g. 10 logins / 5 min) and return `429` with `Retry-After`.

## Exam formats

| Mode | What it is |
|---|---|
| **Proctored** | Scheduled slots + hall tickets, locked full-screen window, violations can end the attempt |
| **Open quiz** | Forms-style: no slots, take it any time inside the availability window, no lockdown; one attempt |

## Results & analytics

- **Candidates** (`/app/results`): latest/average/best %, accuracy, trend, subject accuracy, and per-attempt reports with
  rank, percentile and subject breakdown. The question-by-question review (with correct answers) unlocks only after
  every slot's latest possible finish, or when the exam is closed, so answers never leak to later slots.
- **Admins** (exam → Analytics): completion/absence/termination counts, average/median/σ, score distribution,
  subject averages, per-question difficulty, integrity-event breakdown. Candidates tab exports CSV.

## Webhooks

Set a URL on an exam (Details → Integrations). Every finished attempt is POSTed after the DB commit, retried
(0 s, 2 s, 10 s, 60 s) until a 2xx:

```
X-Qubit-Event: attempt.finished
X-Qubit-Timestamp: 1794146700
X-Qubit-Signature: v1=<hex HMAC-SHA256(secret, timestamp + "." + rawBody)>

{ "event": "attempt.finished", "sentAt": "...", "data": { "status": "SUBMITTED", "score": 212, "maxScore": 300,
  "hallTicketNo": "QB26JM…", "exam": {…}, "candidate": {…}, … } }
```

Verify by recomputing the HMAC with the exam's signing secret (`whsec_…`, rotate any time). "Send test event" posts a `ping`.

## Roles

| Role | Can |
|---|---|
| `QUBIT_USER` | Register for exams, pick/reschedule a slot, download hall ticket, sit the exam, see results |
| `QUBIT_ADMIN` | Everything under `/admin`: exams, questions (incl. JSON import), slots, candidates + CSV, live monitor, hall-ticket lookup |
| `QUBIT_SUPERADMIN` | Admin + user/role management and system diagnostics (`/admin/users`, `/admin/system`) |

## Exam integrity model

- **One attempt** per registration (DB-unique), **server-side clock** (auto-submit sweep every 10 s).
- Entry allowed from slot start until `lateEntryMinutes` after it.
- The exam window requires full screen. The client reports tab switches/minimise, focus loss,
  full-screen exit, DevTools, extra displays, Print Screen, copy/paste/right-click/shortcuts.
- Reports go over `/ws/exam` (REST fallback). Events within 3 s are merged (one alt-tab = one violation).
  When counted violations exceed the exam's `violationTolerance` (0 = first strike), the attempt is terminated.
- Opening the exam in another tab/device (different client session) is a violation; the old tab is shut out.
- Offline for more than 45 s (`qubit.proctoring.disconnect-grace-seconds`) is a violation.
- Invigilators see everything live on `/admin/live` (`/ws/monitor`) and can end an attempt with a reason.

A browser can't stop someone from using a second device. For high-stakes papers, use a
supervised centre or a lockdown-browser/desktop wrapper (planned).

## LMS (courses & protected video)

Admins build **courses → modules → lessons** (video, PDF notes, reading with `$LaTeX$`, quiz linked to an
assessment) at `/admin/courses`, using files from `/admin/media`. Learners browse `/app/courses`, enroll (free for
now, optional validity in days) and learn at `/app/learn` with resume, completion and progress.

### How video is protected

| Layer | What happens |
|---|---|
| Upload | Browser → storage directly, 64 MB multipart, 4 parallel parts, retries (R2 presigned URLs) |
| Transcode | FFmpeg worker: H.264/AAC ladder 240p…2160p (never above source), 6 s segments. NVENC GPU if present, else libx264 |
| Encryption | AES-128 HLS, random key per video, key wrapped with `MEDIA_MASTER_KEY` (AES-256-GCM) in the DB; never stored in R2 |
| Key release | Only via a playback session: owner's JWT + same device id + live heartbeat; ≤ 40 key fetches; revocable; 6 h expiry |
| Segments | Private bucket; signed, expiring URLs (`HMAC(MEDIA_URL_SECRET, path\|exp)`) checked by the Cloudflare Worker |
| Accounts | Max `MEDIA_MAX_STREAMS` (default 2) devices playing at once; same device replaces its old session |
| Deterrence | Moving watermark (email · phone · user id · time), no download / PiP / context menu |

This stops link sharing, download tools and casual capture. It is not Widevine/FairPlay DRM: a determined
user could still extract a key from their own session. For hardware-backed DRM, add a multi-DRM vendor
(e.g. PallyCon/DoveRunner, EZDRM, Axinom) and CENC packaging (Shaka Packager); the player and session layer
are built to swap the key step for a licence request.

### Going live on Cloudflare R2

1. Create a **private** bucket (e.g. `qubit-media`) and an R2 API token with read/write on it.
2. Apply CORS for direct uploads: `infra/cloudflare/r2-cors.json` (must expose `ETag`).
3. Deploy the gateway Worker: `cd infra/cloudflare/media-gateway && npx wrangler deploy`, then
   `npx wrangler secret put MEDIA_URL_SECRET` (same value as the backend `.env`). Route it on e.g. `media.yourdomain.com`.
4. Backend `.env`: `MEDIA_STORAGE=r2`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
   `MEDIA_PUBLIC_BASE=https://media.yourdomain.com`.
5. Run the transcoder where FFmpeg (ideally with an NVIDIA GPU) is installed. To separate it from the API, run
   another instance with `MEDIA_WORKER_ENABLED=true` and set it to `false` on the API nodes.

Never change `MEDIA_MASTER_KEY` once videos exist — they would become unplayable.

## Roadmap

- Schema migrations with Flyway (currently `ddl-auto: update`)
- Desktop lockdown wrapper for high-stakes papers
- Images / LaTeX in questions
- Rate limiting and WebSocket fan-out that work across multiple backend instances (both are in-memory today)
- Multi-DRM (Widevine / FairPlay / PlayReady) for videos; paid courses (Razorpay); live classes
- View-only PDF renderer with watermark (PDFs currently open in the browser viewer via 15-minute links)
"# qubit" 
