import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import matter from 'gray-matter';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function rmrf(p){ if(fs.existsSync(p)) fs.rmSync(p,{recursive:true,force:true}); }
function cp(src,dst){
  if(!fs.existsSync(src)) return;
  const st=fs.statSync(src);
  if(st.isDirectory()){ fs.mkdirSync(dst,{recursive:true}); for(const f of fs.readdirSync(src)) cp(path.join(src,f),path.join(dst,f)); }
  else { fs.mkdirSync(path.dirname(dst),{recursive:true}); fs.copyFileSync(src,dst); }
}
function write(rel,content){ const p=path.join(DIST,rel); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,content); }

// load posts
const dir = path.join(ROOT,'content/posts');
let posts = fs.readdirSync(dir).filter(f=>f.endsWith('.md')).map(f=>{
  const { data, content } = matter(fs.readFileSync(path.join(dir,f),'utf8'));
  const slug = data.slug || f.replace(/\.md$/,'');
  const html = marked.parse(content||'');
  const text = html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const excerpt = text.length>145 ? text.slice(0,145).replace(/\s+\S*$/,'')+'…' : text;
  const d = new Date(data.date);
  const nice = d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
  return { slug, title:data.title||'', date:data.date, nice, thumbnail:data.thumbnail||'', html, excerpt };
}).sort((a,b)=> new Date(b.date)-new Date(a.date));

rmrf(DIST); fs.mkdirSync(DIST,{recursive:true});
cp(path.join(ROOT,'public'), DIST);            // style.css, favicon, wp-content/uploads
cp(path.join(ROOT,'admin'), path.join(DIST,'wp-admin')); // editor at /wp-admin

const head = (title,desc,canon) => `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc((desc||'').slice(0,160))}">
<link rel="canonical" href="${canon}"><link rel="stylesheet" href="/style.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="/feed.xml">
<meta property="og:title" content="${esc(title)}"><meta property="og:type" content="article"></head><body>`;

const sub = site.buttondown ? `<div class="sub"><h3>Get new posts by email</h3>
<form action="https://buttondown.email/api/emails/embed-subscribe/${esc(site.buttondown)}" method="post" target="_blank">
<input type="email" name="email" placeholder="you@email.com" required><button type="submit">Subscribe</button></form></div>` : '';
const foot = `<footer class="site">&copy; ${new Date().getFullYear()} ${esc(site.title)} &middot; <a href="/feed.xml">RSS</a></footer></body></html>`;

// home
const card = (p,lead)=>`<a class="cardlink" href="/${p.slug}/"><div class="card${lead?' lead':''}">`+
  `<span class="ph"${p.thumbnail?` style="background-image:url('${p.thumbnail}')"`:''}></span>`+
  `<div class="bd"><div class="dt">${p.nice}</div><h2>${esc(p.title)}</h2><p>${esc(p.excerpt)}</p></div></div></a>`;
const grid = `<div class="grid">${card(posts[0],true)}${posts.slice(1).map(p=>card(p,false)).join('')}</div>`;
write('index.html', head(site.title, site.tagline, site.url+'/')+
  `<div class="wrap"><header class="site"><div class="t"><a href="/">${esc(site.title)}</a></div><div class="d">${esc(site.tagline)}</div></header>${grid}${sub}</div>`+foot);

// posts
for(const p of posts){
  const hero = p.thumbnail ? `<img class="hero" src="${p.thumbnail}" alt="">` : '';
  write(`${p.slug}/index.html`, head(`${p.title} — ${site.title}`, p.excerpt, `${site.url}/${p.slug}/`)+
    `<div class="post-wrap"><a class="back" href="/">&larr; all posts</a>${hero}<h1 class="post">${esc(p.title)}</h1><div class="meta">${p.nice}</div><article>${p.html}</article>${sub}</div>`+foot);
}

// 404, robots, sitemap, feed, redirects
write('404.html', head('Not found — '+site.title,'','')+`<div class="post-wrap"><h1 class="post">404</h1><p>That page is gone. <a class="back" href="/">Back home</a>.</p></div>`+foot);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
write('_redirects', `/feed/ /feed.xml 301\nhttps://www.gustavosouza.blog/* https://gustavosouza.blog/:splat 301!\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${site.url}/</loc></url>\n`+
  posts.map(p=>`<url><loc>${site.url}/${p.slug}/</loc></url>`).join('\n')+`\n</urlset>\n`);
const rfc = d => new Date(d).toUTCString();
write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n<title>${esc(site.title)}</title><link>${site.url}/</link><description>${esc(site.tagline)}</description>\n`+
  posts.slice(0,20).map(p=>`<item><title>${esc(p.title)}</title><link>${site.url}/${p.slug}/</link><guid>${site.url}/${p.slug}/</guid><pubDate>${rfc(p.date)}</pubDate><description>${esc(p.excerpt)}</description></item>`).join('\n')+`\n</channel></rss>\n`);

console.log('built', posts.length, 'posts ->', DIST);
