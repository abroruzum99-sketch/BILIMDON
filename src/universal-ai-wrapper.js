import legacyWorker from "./index.js";

const PREFIX = "/universal-ai/v1";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || !left || !right) return false;
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

async function rest(env, table, query, method = "GET") {
  const url = new URL("/rest/v1/" + table, env.SUPABASE_URL);
  url.search = query;
  const response = await fetch(url, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error("Supabase read failed: " + table + " (" + response.status + ")");
  return response.json();
}

async function countRows(env, table) {
  const url = new URL("/rest/v1/" + table, env.SUPABASE_URL);
  url.search = "select=id";
  const response = await fetch(url, {
    method: "HEAD",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  if (!response.ok) throw new Error("Supabase count failed: " + table + " (" + response.status + ")");
  const range = response.headers.get("Content-Range") || "";
  const match = range.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function handleReadOnlyApi(request, env) {
  if (request.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!env.UNIVERSAL_AI_API_SECRET || env.UNIVERSAL_AI_API_SECRET.length < 32) {
    return json({ ok: false, error: "Integration is not configured" }, 503);
  }
  const supplied = request.headers.get("Authorization") || "";
  if (!safeEqual(supplied, "Bearer " + env.UNIVERSAL_AI_API_SECRET)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "Data source is not configured" }, 503);
  }

  const url = new URL(request.url);
  try {
    if (url.pathname === PREFIX + "/overview") {
      const [questions, subscribers, answers, sessions, latest] = await Promise.all([
        countRows(env, "quizbot_questions"),
        countRows(env, "quizbot_subscribers"),
        countRows(env, "quizbot_answers"),
        countRows(env, "quizbot_sessions"),
        rest(env, "quizbot_sessions", "select=id,session_date,session_type,status,starts_at,ends_at,finished_at&order=starts_at.desc&limit=5"),
      ]);
      return json({
        ok: true,
        service: "bilimdon",
        source: "existing_cloudflare_worker_supabase",
        counts: { questions, subscribers, answers, sessions },
        recent_sessions: latest,
        capabilities: { read_only: true, publish: false, schedule_changes: false, answer_mutations: false },
      });
    }

    if (url.pathname === PREFIX + "/questions") {
      const items = await rest(
        env,
        "quizbot_questions",
        "select=id,question_text,category,difficulty,status,source,created_at,posted_at&order=created_at.desc&limit=25"
      );
      return json({ ok: true, items });
    }

    if (url.pathname === PREFIX + "/sessions") {
      const items = await rest(
        env,
        "quizbot_sessions",
        "select=id,session_date,session_type,status,starts_at,ends_at,finished_at&order=starts_at.desc&limit=20"
      );
      return json({ ok: true, items });
    }

    if (url.pathname === PREFIX + "/leaderboard") {
      const items = await rest(
        env,
        "quizbot_subscribers",
        "select=username,first_name,score,correct_answers&order=score.desc,correct_answers.desc&limit=10"
      );
      return json({ ok: true, items });
    }

    return json({ ok: false, error: "Not found" }, 404);
  } catch (error) {
    console.error("UNIVERSAL_AI read-only API error:", String(error?.message || error));
    return json({ ok: false, error: "Upstream data could not be read" }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(PREFIX + "/")) {
      return handleReadOnlyApi(request, env);
    }
    return legacyWorker.fetch(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    if (legacyWorker.scheduled) return legacyWorker.scheduled(event, env, ctx);
  },
};
