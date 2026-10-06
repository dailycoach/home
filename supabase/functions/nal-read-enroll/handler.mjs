const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{1,120}$/;

function cors(origin, allowed) {
  const accepted = allowed.includes(origin) ? origin : allowed[0] || "";
  return {
    "Access-Control-Allow-Origin": accepted,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function response(status, body, origin, allowed) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin, allowed) }
  });
}

export function createReadEnrollmentHandler(deps) {
  const { enabled, origins, authenticate, access, claim } = deps;
  return async function handler(request) {
    const origin = request.headers.get("origin") || "";
    if (request.method === "OPTIONS") return response(204, {}, origin, origins);
    if (request.method !== "POST") return response(405, { error: "Method not allowed" }, origin, origins);
    if (origin && !origins.includes(origin)) return response(403, { error: "Origin not allowed" }, origin, origins);
    if (!enabled) return response(503, { error: "NAL READ foundation is not enabled" }, origin, origins);

    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return response(401, { error: "Login required" }, origin, origins);

    let user;
    try { user = await authenticate(token); }
    catch { return response(401, { error: "Invalid session" }, origin, origins); }
    if (!UUID.test(user?.id || "")) return response(401, { error: "Invalid session" }, origin, origins);

    let body;
    try { body = await request.json(); }
    catch { return response(400, { error: "Invalid request body" }, origin, origins); }

    const action = body?.action;
    const seasonSlug = body?.seasonSlug || "";
    if (!SLUG.test(seasonSlug)) return response(400, { error: "Invalid season" }, origin, origins);

    try {
      if (action === "access") {
        const result = await access(user.id, seasonSlug);
        if (!result?.allowed) return response(404, { allowed: false, reason: result?.reason || "not_enrolled" }, origin, origins);
        return response(200, result, origin, origins);
      }
      if (action === "claim") {
        const orderId = body?.orderId || "";
        const requestId = body?.requestId || "";
        if (!UUID.test(orderId) || !UUID.test(requestId)) return response(400, { error: "Invalid enrollment claim" }, origin, origins);
        const result = await claim(user.id, seasonSlug, orderId, requestId);
        if (!result?.allowed) return response(403, { error: "Enrollment unavailable" }, origin, origins);
        return response(200, result, origin, origins);
      }
      return response(400, { error: "Unknown action" }, origin, origins);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Read enrollment unavailable";
      if (/not found|not paid|mismatch|unavailable/i.test(message)) return response(403, { error: message }, origin, origins);
      return response(500, { error: "Read enrollment unavailable" }, origin, origins);
    }
  };
}
