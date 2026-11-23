# UNIVERSAL_AI read-only integration

This integration exposes a small, authenticated, read-only API from the existing Cloudflare Worker. It does not replace the Telegram webhook, the cron trigger, or Supabase. The Worker remains the only Telegram runtime.

## Endpoints

All endpoints require:

`Authorization: Bearer <UNIVERSAL_AI_API_SECRET>`

- `GET /universal-ai/v1/overview` — exact row counts and the five latest sessions.
- `GET /universal-ai/v1/questions` — latest 25 question records (no answer text).
- `GET /universal-ai/v1/sessions` — latest 20 sessions.
- `GET /universal-ai/v1/leaderboard` — public TOP-10 display fields.

The API accepts GET only. It does not expose Telegram tokens, Supabase credentials, correct answers, private answer records, or write/publish/scheduling operations.

## Cloudflare Worker Previews

- Worker Previews are branch-isolated previews under the existing `bilimdon-ai-quiz` Worker; they are not a second Telegram Worker.
- Production continues to use `npm run deploy` (`wrangler deploy`). Feature branches use `npm run deploy:preview` (`wrangler preview`).
- Wrangler 4.135.0 or later is required. The `previews` block in `wrangler.toml` explicitly includes the Workers AI binding.
- Cron Triggers do not invoke a Preview's `scheduled()` handler. Do not add a Cron Trigger, Telegram webhook secrets, or production Telegram credentials to Previews.
- Preview URLs are public by default. Restrict access with Cloudflare Access before sharing sensitive preview content.

## Cloudflare Preview Base secrets

Previews do not inherit Production secrets. In Worker → Settings → Variables and Secrets, select **Previews Base** and configure only the credentials needed for this read-only API:

1. Add a new **Secret** named `UNIVERSAL_AI_API_SECRET` with at least 32 random characters. Do not reuse any existing credential.
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only if you deliberately want this trusted Preview to read the existing Supabase project. The current wrapper uses these names for its GET/HEAD queries. A service-role key is highly privileged; do not add it to a Preview for code or contributors you do not fully trust.
3. Do **not** add `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, Gemini credentials, or any other production Telegram runtime secrets to Previews Base.

Do not put any secret in Git or in `wrangler.toml`. Secrets must be entered in Cloudflare's dashboard. Base secrets apply to newly created Previews; set them before the first Preview deployment.

## UNIVERSAL_AI backend setup

1. Add the same new integration secret to the UNIVERSAL_AI backend as `BILIMDON_API_SECRET`.
2. Set `BILIMDON_WORKER_URL` to the Preview URL while testing. Do not point the test integration at Production until Preview verification and owner approval.
3. Set `BILIMDON_ADMIN_USER_IDS` to a comma-separated list of UNIVERSAL_AI account IDs permitted to view the dashboard.
4. Test the four GET endpoints from the backend. Do not invoke `/setup`, `setWebhook`, or any Telegram send endpoint as part of this check.

## Existing automation to review

The repository also contains a legacy GitHub Actions workflow with scheduled Python batch-send jobs at 03:00, 09:00, 15:00, and 16:00 UTC. Those jobs are separate from the Cloudflare Worker Cron Trigger and may publish additional messages if their GitHub secrets are configured. This PR intentionally leaves that workflow unchanged; confirm whether those extra publishing times are still wanted before disabling them. Do not run its manual dispatch while validating the Worker unless an administrator intends to publish a batch.

## Deployment safety

- Do not start the legacy Python polling bot or another webhook consumer with the same Telegram bot token.
- Keep the existing one-minute Production Cron Trigger unchanged.
- Do not change the current Telegram webhook URL.
- Do not run migrations or modify existing Supabase tables for this read-only integration.
- Merge/deploy to Production only after Preview verification and explicit owner approval.

## Local smoke check

After configuring the Preview Base secrets and both application secret stores, a backend administrator can open the Bilimdon workspace in UNIVERSAL_AI. A missing integration secret or non-admin account must fail closed with an error; no data should be exposed.
