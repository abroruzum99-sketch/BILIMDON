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

## Supabase least-privilege design

- The Worker uses the Supabase anon/publishable key only to call one dedicated RPC: `public.universal_ai_read`.
- The RPC checks a high-entropy shared secret using a SHA-256 hash stored in the non-exposed `private` schema.
- The RPC returns only four fixed resources and explicitly selected columns. It does not accept table names, SQL, filters, or arbitrary query input.
- The existing `quizbot_*` tables retain their current RLS settings and grants; no public SELECT policy is added.
- Never configure or ship the Supabase service-role key for this integration.

## Cloudflare Worker Previews

- Worker Previews are branch-isolated previews under the existing `bilimdon-ai-quiz` Worker; they are not a second Telegram Worker.
- Production continues to use `npm run deploy` (`wrangler deploy`). Feature branches use `npm run deploy:preview` (`wrangler preview`).
- Wrangler 4.135.0 or later is required. The `previews` block in `wrangler.toml` explicitly includes the Workers AI binding.
- Cron Triggers do not invoke a Preview's `scheduled()` handler. Do not add a Cron Trigger, Telegram webhook secrets, or production Telegram credentials to Previews.
- Preview URLs are public by default. Restrict access with Cloudflare Access before sharing sensitive preview content.

## Cloudflare Preview Base secrets and variables

Previews do not inherit Production secrets. In Worker → Settings → Variables and Secrets, select **Previews Base** and configure:

1. Secret `UNIVERSAL_AI_API_SECRET` — use the exact one-time integration secret supplied by the project owner; do not put it in Git.
2. Variable `SUPABASE_URL` — the existing Supabase project URL.
3. Variable `SUPABASE_ANON_KEY` — the Supabase anon/publishable key. Do not use the service-role key.

Do **not** add `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, Gemini credentials, or any other production Telegram runtime secrets to Previews Base. Base secrets apply to newly created Previews; redeploy the Preview after setting them.

## UNIVERSAL_AI backend setup

1. Add the same `UNIVERSAL_AI_API_SECRET` value to the UNIVERSAL_AI backend as `BILIMDON_API_SECRET`.
2. Set `BILIMDON_WORKER_URL` to the Preview URL while testing. Do not point the test integration at Production until Preview verification and owner approval.
3. Set `BILIMDON_ADMIN_USER_IDS` to a comma-separated list of UNIVERSAL_AI account IDs permitted to view the dashboard.
4. Test the four GET endpoints from the backend. Do not invoke `/setup`, `setWebhook`, or any Telegram send endpoint as part of this check.

## Existing automation to review

The repository also contains a legacy GitHub Actions workflow with scheduled Python batch-send jobs at 03:00, 09:00, 15:00, and 16:00 UTC. Those jobs are separate from the Cloudflare Worker Cron Trigger and may publish additional messages if their GitHub secrets are configured. This PR intentionally leaves that workflow unchanged; confirm whether those extra publishing times are still wanted before disabling them. Do not run its manual dispatch while validating the Worker unless an administrator intends to publish a batch.

## Deployment safety

- Do not start the legacy Python polling bot or another webhook consumer with the same Telegram bot token.
- Keep the existing one-minute Production Cron Trigger unchanged.
- Do not change the current Telegram webhook URL.
- The migration adds only a private secret-hash table and a fixed read-only RPC; it does not modify existing quizbot tables or their RLS policies.
- Merge/deploy to Production only after Preview verification and explicit owner approval.

## Local smoke check

After configuring the Preview Base values and the UNIVERSAL_AI backend secret, a backend administrator can open the Bilimdon workspace in UNIVERSAL_AI. A missing integration secret or non-admin account must fail closed with an error; no data should be exposed.
