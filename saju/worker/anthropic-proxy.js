// Cloudflare Worker — 브라우저에는 키를 노출하지 않고 Claude API로 전달하는 프록시.
// 배포: wrangler로 이 파일을 올리고, Secrets에 ANTHROPIC_API_KEY, Vars에 ALLOWED_ORIGIN(예: https://xxx.github.io)을 넣는다.
// 앱 설정 화면에서 "프록시 주소"에 이 Worker의 URL을 입력하면 된다.

const ALLOWED_MODELS = new Set(['claude-opus-5', 'claude-sonnet-5']);
const MAX_TOKENS_CAP = 6000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = !env.ALLOWED_ORIGIN || env.ALLOWED_ORIGIN.split(',').map((s) => s.trim()).includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, anthropic-version, anthropic-beta',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    if (!allowed) return new Response(JSON.stringify({ error: { message: 'origin not allowed' } }), { status: 403, headers: { ...cors, 'content-type': 'application/json' } });

    let body;
    try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: { message: 'invalid json' } }), { status: 400, headers: cors }); }
    if (!ALLOWED_MODELS.has(body.model)) body.model = 'claude-opus-5';
    body.max_tokens = Math.min(Number(body.max_tokens) || 4000, MAX_TOKENS_CAP);
    body.stream = true;

    const headers = {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
    };
    const beta = request.headers.get('anthropic-beta');
    if (beta) headers['anthropic-beta'] = beta;

    const upstream = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
    const out = new Headers(cors);
    out.set('content-type', upstream.headers.get('content-type') || 'text/event-stream');
    out.set('cache-control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
