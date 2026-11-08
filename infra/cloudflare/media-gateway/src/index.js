/**
 * Qubit media gateway — sits in front of the PRIVATE R2 bucket and serves encrypted HLS segments.
 *
 * A request is served only if it carries a signature minted by the Qubit backend for a live
 * playback session:  sig = hex(HMAC-SHA256(MEDIA_URL_SECRET, pathname + "|" + exp)).
 * Segments are AES-128 encrypted; the key is never stored in R2 and is only released by the
 * backend to the session owner, so even a leaked segment URL is useless on its own.
 */
const SEGMENT = /^videos\/\d+\/hls\/\d{3,4}p\/seg_\d{5}\.ts$/;

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), env);
    if (request.method !== 'GET' && request.method !== 'HEAD') return text('Method not allowed', 405, env);

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1));
    if (!SEGMENT.test(key)) return text('Not found', 404, env);

    const exp = Number(url.searchParams.get('exp'));
    const sig = url.searchParams.get('sig') || '';
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return text('Link expired', 403, env);

    const expected = await hmacHex(env.MEDIA_URL_SECRET, `${url.pathname}|${exp}`);
    if (!timingSafeEqual(expected, sig)) return text('Forbidden', 403, env);

    // Encrypted segments are immutable — cache them at the edge, keyed without the signature.
    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
    let res = await cache.match(cacheKey);
    if (!res) {
      const obj = await env.MEDIA_BUCKET.get(key);
      if (!obj) return text('Not found', 404, env);
      res = new Response(obj.body, {
        headers: {
          'Content-Type': 'video/mp2t',
          'Cache-Control': 'public, max-age=31536000, immutable',
          ETag: obj.httpEtag,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }
    return withCors(new Response(request.method === 'HEAD' ? null : res.body, res), env);
  },
};

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', k, enc.encode(message));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function withCors(res, env) {
  const r = new Response(res.body, res);
  r.headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN || '*');
  r.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  r.headers.set('Vary', 'Origin');
  return r;
}

function text(body, status, env) {
  return withCors(new Response(body, { status, headers: { 'Content-Type': 'text/plain' } }), env);
}
