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

async function readResource(env, resource) {
  const url = new URL("/rest/v1/rpc/universal_ai_read", env.SUPABASE_URL);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: "Bearer " + env.SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ p_secret: env.UNIVERSAL_AI_API_SECRET, p_resource: resource }),
  });
  if (!response.ok) {
    console.error("Supabase read-only RPC failed:", response.status);
    throw new Error("Read-only data request failed");
  }
  return response.json();
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
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return json({ ok: false, error: "Data source is not configured" }, 503);
  }

  const url = new URL(request.url);
  const resources = {
    [PREFIX + "/overview"]: "overview",
    [PREFIX + "/questions"]: "questions",
    [PREFIX + "/sessions"]: "sessions",
    [PREFIX + "/leaderboard"]: "leaderboard",
  };
  const resource = resources[url.pathname];
  if (!resource) return json({ ok: false, error: "Not found" }, 404);

  try {
    return json(await readResource(env, resource));
  } catch (error) {
    console.error("UNIVERSAL_AI read-only API error:", String(error?.message || error));
    return json({ ok: false, error: "Upstream data could not be read" }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(PREFIX + "/")) return handleReadOnlyApi(request, env);
    return legacyWorker.fetch(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    if (legacyWorker.scheduled) return legacyWorker.scheduled(event, env, ctx);
  },
};
