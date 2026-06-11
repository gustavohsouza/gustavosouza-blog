export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookie = (request.headers.get('Cookie') || '').match(/oauth_state=([^;]+)/);
  const provider = 'github';
  const page = (status, obj) => {
    const msg = 'authorization:' + provider + ':' + status + ':' + JSON.stringify(obj);
    const html = '<!doctype html><html><body><script>(function(){'
      + 'var msg=' + JSON.stringify(msg) + ';'
      + 'function rx(e){if(window.opener){window.opener.postMessage(msg,e.origin);}window.removeEventListener("message",rx,false);}'
      + 'window.addEventListener("message",rx,false);'
      + 'if(window.opener){window.opener.postMessage("authorizing:' + provider + '","*");}'
      + '})();</script></body></html>';
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  };
  if (!code || !state || !cookie || cookie[1] !== state) {
    return page('error', { error: 'Invalid state' });
  }
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'gustavosouza-blog-cms' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
  });
  const data = await res.json();
  if (data.access_token) return page('success', { token: data.access_token, provider });
  return page('error', { error: data.error_description || data.error || 'No token' });
}
