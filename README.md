# BILIMDON
BILIMDON — AI Quiz Bot

## Deployment
The existing Telegram bot runs on Cloudflare Workers. The original Python runtime is retained for legacy/reference use and must not be started with the same bot token while the Worker is active. For the serverless Telegram deployment, follow [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md).

## UNIVERSAL_AI integration
A separate authenticated read-only API is being added on the feature branch. See [UNIVERSAL_AI_READ_ONLY_API.md](docs/UNIVERSAL_AI_READ_ONLY_API.md). It preserves the current Telegram webhook, Cron Trigger, and Supabase schema; it does not publish quizzes or modify schedules.
