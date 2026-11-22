# BILIMDON — Cloudflare Workers deploy

This deployment runs the Telegram bot as a Cloudflare Worker. Do not commit secrets. Gemini is the primary quiz-question generator; Cloudflare Workers AI is the fallback. Quiz images use Cloudflare AI unless the optional `GEMINI_IMAGE_MODEL` variable is explicitly configured.

## Cloudflare setup

1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up.
2. Open **Workers & Pages** → **Create** → **Connect to Git** and select `abroruzum99-sketch/BILIMDON`.
3. Worker name: `bilimdon-ai-quiz`. Root directory: `/`.
4. Build command: `npm install`. Deploy command: `npx wrangler deploy`.
5. After first deployment, open the Worker → **Settings** → **Variables and Secrets**. Add these as secrets (except SUPABASE_URL may be a text variable):
   - `BOT_TOKEN` — Telegram BotFather token
   - `GEMINI_API_KEY` — Google AI Studio key
   - `SUPABASE_URL` — `https://rjbrhvrudlbyvwrdjfvb.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service_role/secret key (never put in GitHub)
   - `TELEGRAM_WEBHOOK_SECRET` — make a random 32+ character string using only A-Z, a-z, 0-9, underscore or hyphen
   - `GEMINI_MODEL` — text variable, `gemini-3.8-flash` (optional; this is the default)
   - `GEMINI_IMAGE_MODEL` — optional text variable, `gemini-3.1-flash-lite-image` (enables Gemini-generated quiz images; image generation may require a paid Google AI plan and is not enabled unless you add this variable)
6. Save variables and redeploy.

## Telegram webhook

After deploy, copy the Worker URL, then set the webhook once. Replace placeholders locally; never send tokens in chat or commit them:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<WORKER-URL>/telegram","secret_token":"<TELEGRAM_WEBHOOK_SECRET>","allowed_updates":["message","callback_query","poll_answer"]}'
```

Test `https://<WORKER-URL>/health`; it should return `{"ok":true,"service":"bilimdon"}`.

## Safe activation

The database setting `quizbot_settings.enabled` must remain `false` until:
- Cloudflare deployment succeeds;
- the health endpoint responds;
- Telegram webhook is set and `/start` works;
- the bot is admin in `@universal_ai_quiz`.

Only then enable `enabled` for the single settings row. Do not enable it before testing.

## Quiz schedule and retry behavior

The bot checks the 16:39 afternoon session during 16:39–16:59 and the 18:00 evening session during 18:00–18:19 (Tashkent time). If AI generation fails during that window, the next cron tick retries the session. Each cron tick posts at most five questions.

## Image generation and billing

By default, images continue to use the Cloudflare Workers AI binding. To route image generation through Gemini, explicitly add `GEMINI_IMAGE_MODEL=gemini-3.1-flash-lite-image` as a Worker text variable. Google's current pricing page lists no free tier for this image model, so do not enable it unless the Google AI project has billing configured and you accept image-generation charges.

## Free-plan notes

Cloudflare Workers Free has daily request and CPU limits. Google Gemini may have separate free-tier quotas. Supabase Free can pause under its inactivity rules; no free hosting provider guarantees permanent 100% uptime.
