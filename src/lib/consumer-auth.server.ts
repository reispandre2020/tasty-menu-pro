// Helpers compartilhados pelos endpoints /api/consumer/*.
// Auth: Bearer token estático em CONSUMER_API_TOKEN.

export function checkConsumerAuth(request: Request): Response | null {
  const expected = process.env.CONSUMER_API_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "consumer_integration_disabled", message: "Defina o secret CONSUMER_API_TOKEN no projeto." },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
};
