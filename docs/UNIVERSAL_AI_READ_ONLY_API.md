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

## Cloudflare setup

1. Deploy the feature branch to a Cloudflare Preview environment first.
2. In Worker → Settings → Variables and Secrets, add a **Secret** named `UNIVERSAL_AI_API_SECRET`.
3. Generate a new random secret with at least 32 characters. Do not reuse `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, or the Supabase service-role key.
4. Add the same value to the UNIVERSAL_AI backend environment as `BILIMDON_API_SECRET`.
5. Set `BILIMDON_WORKER_URL=https://bilimdon-ai-quiz.abroruzum99.workers.dev` in the UNIVERSAL_AI backend environment.
6. Set `BILIMDON_ADMIN_USER_IDS` to a comma-separated list of UNIVERSAL_AI account IDs permitted to view the dashboard.
7. Test the four GET endpoints from the backend. Do not invoke `/setup`, `setWebhook`, or any Telegram send endpoint as part of this check.

## Deployment safety

- Do not start the legacy Python polling bot or another webhook consumer with the same Telegram bot token.
- Keep the existing one-minute Cron Trigger unchanged.
- Do not change the current Telegram webhook URL.
- Do not run migrations or modify existing Supabase tables for this read-only integration.
- Merge/deploy to Production only after Preview verification and explicit owner approval.

## Local smoke check

After configuring both secret stores, a backend administrator can open the Bilimdon workspace in UNIVERSAL_AI. A missing secret or non-admin account must fail closed with an error; no data should be exposed.
