import { createReadEnrollmentHandler } from "./handler.mjs";

const base = Deno.env.get("SUPABASE_URL") || "";
const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const origins = (Deno.env.get("NAL_ALLOWED_ORIGINS") || "https://daily-coach-ing.com")
  .split(",").map((value) => value.trim()).filter(Boolean);
const enabled = Deno.env.get("NAL_READ_ENABLED") === "true"
  && /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(base)
  && Boolean(publicKey && serviceKey);

async function rpc(name: string, args: Record<string, unknown>) {
  const result = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args)
  });
  const body = await result.json().catch(() => null);
  if (!result.ok) throw new Error(body?.message || body?.error || "Database operation unavailable");
  return body;
}

Deno.serve(createReadEnrollmentHandler({
  enabled,
  origins,
  authenticate: async (token: string) => {
    const result = await fetch(`${base}/auth/v1/user`, {
      signal: AbortSignal.timeout(10000),
      headers: { apikey: publicKey, Authorization: `Bearer ${token}` }
    });
    if (!result.ok) throw new Error("Invalid session");
    return result.json();
  },
  access: (userId: string, seasonSlug: string) =>
    rpc("nal_get_read_access", { p_user_id: userId, p_season_slug: seasonSlug }),
  claim: (userId: string, seasonSlug: string, orderId: string, requestId: string) =>
    rpc("nal_issue_read_enrollment", {
      p_user_id: userId,
      p_season_slug: seasonSlug,
      p_order_id: orderId,
      p_request_id: requestId
    })
}));
