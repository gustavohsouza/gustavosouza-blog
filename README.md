# gustavosouza.blog

Blog estatico. Posts em Markdown em `content/posts/`. Build com Node gera `dist/`.

## Local
    npm install
    npm run build      # gera ./dist

## Editar posts
Acesse https://gustavosouza.blog/wp-admin (editor Sveltia CMS).
Logar com GitHub, escrever, salvar -> commit no repo -> deploy automatico.

## Deploy
Cloudflare (Pages ou Workers Build): build command `npm run build`, output `dist`.
