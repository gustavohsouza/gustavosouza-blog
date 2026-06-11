export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) return new Response('Missing GITHUB_CLIENT_ID', { status: 500 });
  const state = crypto.randomUUID();
  const redirectUri = url.origin + '/oauth/callback';
  const authorize = 'https://github.com/login/oauth/authorize'
    + '?client_id=' + encodeURIComponent(clientId)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&scope=' + encodeURIComponent('repo,user')
    + '&state=' + state;
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize,
      'Set-Cookie': 'oauth_state=' + state + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600',
    },
  });
}
