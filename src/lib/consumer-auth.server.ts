// Helpers compartilhados pelos endpoints /api/consumer/*.
// Auth: token estático em CONSUMER_API_TOKEN.
// Aceita o token em vários formatos para máxima compatibilidade
// com o painel do Consumer (que pode enviar como Bearer, raw,
// X-API-Key, x-access-token, etc).

export function checkConsumerAuth(request: Request): Response | null {
  const expected = (process.env.CONSUMER_API_TOKEN ?? "").trim();
  if (!expected) {
    return Response.json(
      { error: "consumer_integration_disabled", message: "Defina o secret CONSUMER_API_TOKEN no projeto." },
      { status: 503 },
    );
  }

  // Coleta candidatos de token de vários headers / query param.
  const candidates: string[] = [];
  const auth = (request.headers.get("authorization") ?? "").trim();
  if (auth) {
    if (/^bearer\s+/i.test(auth)) candidates.push(auth.replace(/^bearer\s+/i, "").trim());
    else if (/^token\s+/i.test(auth)) candidates.push(auth.replace(/^token\s+/i, "").trim());
    else candidates.push(auth);
  }
  for (const h of [
    "x-api-key",
    "x-access-token",
    "x-auth-token",
    "x-consumer-token",
    "api-key",
    "apikey",
    "token",
  ]) {
    const v = request.headers.get(h);
    if (v) candidates.push(v.trim());
  }
  // Query param fallback (?token=... ou ?apiKey=...)
  try {
    const url = new URL(request.url);
    for (const k of ["token", "apiKey", "api_key", "access_token"]) {
      const v = url.searchParams.get(k);
      if (v) candidates.push(v.trim());
    }
  } catch { /* noop */ }

  const ok = candidates.some((c) => c === expected);

  if (!ok) {
    // Log para diagnosticar o formato de auth que o Consumer está usando.
    // Não vaza o valor esperado, apenas o que chegou (truncado).
    const safeHeaders: Record<string, string> = {};
    for (const h of ["authorization", "x-api-key", "x-access-token", "x-auth-token", "x-consumer-token", "api-key", "apikey", "token", "user-agent"]) {
      const v = request.headers.get(h);
      if (v) safeHeaders[h] = v.length > 12 ? `${v.slice(0, 6)}…${v.slice(-4)} (len=${v.length})` : `*** (len=${v.length})`;
    }
    console.warn("[consumer-auth] 401 — headers recebidos:", JSON.stringify(safeHeaders), "url=", request.url);
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json", ...CORS_HEADERS },
    });
  }
  return null;
}

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
  "access-control-allow-headers": "authorization,content-type,x-api-key,x-access-token,x-auth-token,x-consumer-token,api-key,apikey,token",
};
