# PRD — Conversor de Imagens e Modelos 3D em Sets de LEGO

| Campo | Valor |
|---|---|
| Autor | Gustavo Souza (g@saasholic.com) |
| Status | Rascunho — aguardando respostas das questões em aberto (§10) |
| Data | 2026-06-12 |
| Codinome provisório | **Brickify** (nome final em aberto — ver §10) |

---

## 1. Visão geral

Aplicação que converte conteúdo visual criado ou fornecido pelo usuário em **sets de LEGO compráveis e montáveis**, entregando três artefatos para cada conversão:

1. **O design do set** (visualização do resultado final);
2. **A lista de peças (BOM)** com cores, quantidades e link/arquivo para compra das peças reais;
3. **O manual de instruções** passo a passo, no estilo dos manuais oficiais LEGO.

O produto evolui em quatro versões, cada uma ampliando o tipo de entrada aceita:

| Versão | Entrada | Saída | Resumo |
|---|---|---|---|
| **v1** | Imagem 2D (foto, ilustração) | Set 2D (mosaico) | Conversão de imagem em mosaico de peças, com BOM e manual |
| **v2** | Arquivo 3D (STL, OBJ, glTF, 3MF) | Set 3D | "Legolização" de malha 3D, com controle de complexidade/raridade de peças e opções de acessibilidade de custo |
| **v3** | Imagem 2D do objeto desejado | Set 3D | Geração de modelo 3D a partir da imagem (IA image-to-3D) e reaproveitamento do pipeline da v2 |
| **v4** | — | — | Disponibilização pública na web para qualquer pessoa (multiusuário, contas, fila de processamento, possivelmente monetização) |

### 1.1 Problema

Criar um set de LEGO personalizado hoje exige conhecimento de ferramentas técnicas (BrickLink Studio, LDraw), entendimento manual de quais peças existem em quais cores, montagem manual da lista de compras e produção manual de instruções. O processo é inacessível para a maioria das pessoas.

### 1.2 Proposta de valor

"Da imagem ao set montado na sua mesa": o usuário fornece uma imagem (ou modelo 3D), e recebe tudo o que precisa para comprar as peças e montar — sem conhecimento técnico de LEGO CAD.

---

## 2. Público-alvo

- **v1–v3 (pessoal):** o próprio autor e círculo próximo — validação do pipeline.
- **v4 (público):** AFOLs (Adult Fans of LEGO), pais/presenteadores ("transforme o desenho do seu filho em LEGO"), criadores de conteúdo, decoradores (mosaicos de parede estilo LEGO Art).

---

## 3. v1 — Imagem 2D → Set mosaico 2D

### 3.1 Fluxo do usuário

1. Upload da imagem (JPG/PNG/WebP).
2. Recorte e enquadramento (crop interativo).
3. Escolha do tamanho físico do mosaico — em studs (ex.: 32×32, 48×48, 64×64, 96×96) ou em cm, com preview de dimensão real e contagem de baseplates.
4. Escolha da paleta: todas as cores LEGO atualmente produzidas, ou subconjunto (ex.: só cores baratas/comuns, tons de cinza, sépia).
5. Ajustes: brilho/contraste/saturação, dithering on/off (Floyd–Steinberg), realce de bordas.
6. Preview em tempo real do mosaico com estimativa de custo.
7. Geração dos entregáveis: BOM + arquivo de compra + manual PDF.

### 3.2 Pipeline técnico

```
imagem → crop/resize para N×M studs → quantização de cor para a paleta LEGO
(espaço CIELAB, opcional dithering) → [otimização opcional: merge de 1×1 em
plates maiores 1×2/2×2/2×4 da mesma cor para reduzir custo] → BOM → manual
```

Decisões técnicas embutidas:

- **Peça base do mosaico:** plate 1×1 (quadrada ou redonda, estilo LEGO Art) ou tile 1×1. Definir default e se é opção do usuário.
- **Quantização no espaço CIELAB** (ΔE) e não RGB, para fidelidade perceptual.
- **Paleta de cores:** derivada do catálogo de cores em produção (fonte: BrickLink/Rebrickable). Cores raras encarecem muito o set — a paleta default deve considerar disponibilidade e preço, não só existência da cor.
- **Merge de peças:** mosaicos só de 1×1 são mais caros e tediosos; agrupar regiões da mesma cor em plates maiores reduz custo (~30–50% em áreas chapadas). Trade-off: manual mais complexo. Deve ser um toggle.

### 3.3 Entregáveis da conversão

1. **Visualização final** (render do mosaico, comparação lado a lado com a original).
2. **BOM:** tabela peça × cor × quantidade, com preço estimado por item e total.
3. **Arquivo de compra:** Wanted List XML do BrickLink (upload direto no site), e/ou CSV para Rebrickable/BrickOwl, e/ou link para LEGO Pick a Brick. *(Decisão pendente — ver §10.)*
4. **Manual PDF:** mosaico dividido em seções (ex.: blocos de 16×16, como nos sets LEGO Art), cada seção com grade numerada cor a cor; capa com a arte final; lista de peças por seção.

### 3.4 Requisitos não funcionais (v1)

- Conversão de imagem ≤ 5 s para mosaicos até 96×96 (processável no navegador/edge — não exige GPU).
- Geração de PDF ≤ 30 s.
- Nenhum dado persistido além da sessão (v1 é single-user).

### 3.5 Fora de escopo da v1

Mosaicos com relevo (alturas), mosaicos com peças que não 1×1/plates, montagem 3D, contas de usuário, pagamento.

---

## 4. v2 — Arquivo 3D → Set LEGO 3D

### 4.1 Fluxo do usuário

1. Upload de malha 3D (STL, OBJ, glTF/GLB, 3MF).
2. Escolha de escala/resolução (em studs na maior dimensão; preview do tamanho físico final).
3. Configuração do **perfil de peças** (ver §4.3).
4. Escolha de modo de cor: cor única, cores do modelo (se a malha tiver textura/cores por vértice), ou paleta manual.
5. Conversão → preview 3D interativo navegável (girar/zoom, "explodir" camadas).
6. Geração: BOM + arquivo de compra + manual passo a passo + export para formatos LEGO CAD.

### 4.2 Pipeline técnico

```
malha 3D → reparo/fechamento da malha → voxelização na resolução escolhida
(voxel = 1 stud de largura; atenção ao aspect ratio do brick: 1 brick de altura
= 1,2× a largura → voxel não-cúbico ou uso de plates) → legolização: cobertura
dos voxels com peças reais do inventário permitido, otimizando conectividade
estrutural (evitar "ilhas" e camadas que se soltam) → verificação de
estabilidade → coloração → ordenação de montagem → BOM + manual + exports
```

Pontos técnicos críticos:

- **Legolização é o problema central da v2.** Não basta cobrir voxels: o layout de peças precisa intertravar camadas (brick bonding) para o modelo não desmontar. Há literatura acadêmica ("Legolization: Optimizing LEGO Designs", Luo et al. 2015; trabalhos de Testuz et al. 2013) com abordagens de grafo de conectividade + refinamento local. Implementar a heurística de merge + análise de componentes conexos como baseline; otimização de estabilidade física como melhoria incremental.
- **Interior oco vs. maciço:** modelos grandes maciços ficam caros e pesados; ocar o interior (shell de 1–2 bricks) com suportes internos é padrão da indústria. Toggle com default = oco.
- **Geometria não-cúbica (slopes, curvas):** ver perfil de peças abaixo.
- **Exports:** LDraw (.ldr) como formato canônico interno (ecossistema aberto: renderização, LPub3D para instruções) e export para BrickLink Studio (.io) se viável.

### 4.3 Perfil de peças (o requisito de acessibilidade da v2)

O usuário controla o trade-off **fidelidade × custo × dificuldade de compra** por meio de perfis:

| Perfil | Peças permitidas | Efeito |
|---|---|---|
| **Básico** | Bricks e plates retangulares comuns (1×1 a 2×8), cores top-20 mais baratas | Mais barato e fácil de comprar; visual mais "pixelado" |
| **Padrão** | + slopes comuns, tiles, bricks 1×N longos | Equilíbrio |
| **Avançado** | + slopes invertidos, curvas, brackets/SNOT, qualquer cor em produção | Maior fidelidade; mais caro |
| **Sem limites** | Qualquer peça já produzida (incl. raras/aposentadas) | Máxima fidelidade; custo e disponibilidade imprevisíveis |
| **Personalizado** | Usuário marca categorias de peças e teto de preço por peça | Controle total |

Adicionalmente, em qualquer perfil:

- **Teto de orçamento:** o usuário define um valor máximo e o conversor ajusta resolução/paleta para caber no teto.
- **Substituição inteligente:** se uma peça/cor está cara ou indisponível, sugerir substituições (ex.: 2 plates no lugar de 1 brick; cor próxima em ΔE).
- **Índice de disponibilidade:** sinalizar no BOM peças com poucos vendedores ou preço volátil.

### 4.4 Manual de instruções 3D

- Ordenação por camadas (bottom-up), com agrupamento em **submodelos** quando o modelo for grande.
- Cada passo: render isométrico do estado atual + peças adicionadas destacadas + callout das peças do passo (estilo manual oficial).
- Geração via pipeline LDraw → LPub3D (headless) **ou** renderizador próprio (three.js + biblioteca de geometria LDraw). *(Decisão pendente — ver §10.)*
- Validação de montabilidade: nenhum passo pode exigir inserir peça em local fisicamente inacessível (colisão de mão/peça) — na v2, heurística simples (montagem estritamente por camadas evita a maior parte dos casos).

### 4.5 Fora de escopo da v2

Minifigs, peças técnicas (Technic) com função mecânica, decalques/peças impressas, motorização.

---

## 5. v3 — Imagem → Modelo 3D → Set LEGO

### 5.1 Conceito

O usuário envia uma ou mais fotos/ilustrações do objeto que quer em LEGO (não um modelo 3D pronto). O sistema gera o modelo 3D via IA (image-to-3D) e injeta o resultado no pipeline da v2.

```
imagem(ns) → segmentação/remoção de fundo → geração 3D (modelo de IA
image-to-3D) → revisão pelo usuário (preview da malha, regenerar/ajustar) →
pipeline v2 (voxelização → legolização → BOM → manual)
```

### 5.2 Decisões específicas

- **Modelo de geração 3D:** auto-hospedado open source (ex.: família TripoSR/TRELLIS/Hunyuan3D — exige GPU) vs. API de terceiros (ex.: Meshy, Tripo3D — custo por geração, sem infra GPU). *(Decisão pendente — ver §10; recomendação: API de terceiros na v3, reavaliar custo na v4.)*
- **Etapa de revisão humana é obrigatória:** geração 3D por IA erra com frequência; o usuário precisa aprovar/regenerar a malha antes de gastar tempo no pipeline de legolização.
- **Múltiplas vistas:** aceitar 1 foto (mais fácil, menos fiel) e opcionalmente 2–4 vistas para melhorar a reconstrução.

---

## 6. v4 — Disponibilização pública na web

Não é escopo de implementação agora, mas as versões anteriores devem ser construídas **sem decisões que inviabilizem a v4**:

- Contas de usuário, galeria de criações (privadas/públicas), histórico.
- Fila assíncrona para jobs pesados (legolização de modelos grandes, geração 3D).
- Limites de uso/rate limiting; possivelmente plano gratuito + pago.
- Moderação de conteúdo (uploads públicos de imagem).
- Compartilhamento de sets entre usuários ("monte o set de outra pessoa").

**Implicação arquitetural imediata:** separar desde a v1 o *core de conversão* (biblioteca pura, sem UI) da *aplicação web*, para que o mesmo core sirva CLI local (v1–v3) e backend público (v4).

---

## 7. Arquitetura proposta (alto nível)

```
┌─────────────────────────────────────────────────────┐
│ Web App (SPA)                                       │
│ upload, crop, previews 2D/3D (three.js), configuração│
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│ Core de conversão (biblioteca isolada)              │
│ • mosaic-engine (v1): quantização, dithering, merge │
│ • voxelizer + legolizer (v2)                        │
│ • instruction-generator (PDF 2D / passos 3D)        │
│ • bom-builder + exporters (BrickLink XML, LDraw…)   │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│ Serviços de dados                                   │
│ • Catálogo de peças/cores (Rebrickable dump,        │
│   atualizado periodicamente)                        │
│ • Preços (BrickLink Price Guide API, cache diário)  │
│ • (v3) API de geração image-to-3D                   │
└─────────────────────────────────────────────────────┘
```

Observações:

- **v1 pode rodar 100% no navegador** (quantização e PDF são leves) — zero custo de servidor e deploy estático no Cloudflare (alinhado à infra que o autor já usa). A legolização da v2 provavelmente também roda no browser via WASM para modelos pequenos/médios; jobs grandes podem exigir backend.
- **Catálogo de peças:** Rebrickable fornece dumps completos (peças, cores, relacionamentos) com licença permissiva — usar como base canônica, com IDs mapeados para BrickLink.
- **Preços:** BrickLink Price Guide exige API key e tem rate limits; cachear agressivamente (preço médio por peça+cor, refresh diário).

---

## 8. Métricas de sucesso

| Versão | Métrica |
|---|---|
| v1 | O autor compra as peças de um mosaico gerado e monta usando só o manual, sem travar |
| v2 | Um modelo 3D convertido é montado fisicamente e **não desmonta ao ser manuseado** |
| v3 | ≥ 50% das gerações 3D são aprovadas pelo usuário em até 3 tentativas |
| v4 | Usuários externos completam o funil upload → compra de peças sem suporte |

---

## 9. Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| **Marca LEGO:** o produto não pode sugerir afiliação com a LEGO; "LEGO" é marca registrada | Alta (na v4) | Nome próprio + disclaimer "compatível com peças de montar"; revisar diretrizes de fair use da LEGO antes da v4 |
| Peça/cor indisponível no mercado no momento da compra | Média | Índice de disponibilidade + substituição inteligente (§4.3) |
| Modelos 3D estruturalmente instáveis (desmontam) | Alta (v2) | Legolização com análise de conectividade; cola como última instância documentada no manual |
| Custo real do set muito acima da estimativa | Média | Preços com margem de segurança; aviso de volatilidade |
| Custo de GPU/API na v3 | Média | Começar com API de terceiros pay-per-use; cota por usuário |
| Dependência de APIs de terceiros (BrickLink) | Média | Cache local de preços; fallback para múltiplos marketplaces |

---

## 10. Questões em aberto (decisões necessárias antes de iniciar)

### Produto

1. **P1 — Peça do mosaico (v1):** default com plates 1×1 quadradas, redondas (estilo LEGO Art) ou tiles? Opção exposta ao usuário?
2. **P2 — Otimização de custo no mosaico:** merge em plates maiores ligado por padrão, ou mosaico "puro" 1×1 por padrão?
3. **P3 — Tamanhos suportados na v1:** quais presets (32×32 até 96×96? maior?) e há limite superior?
4. **P4 — Formato de compra prioritário:** BrickLink Wanted List, Rebrickable CSV, LEGO Pick a Brick, ou todos? (Pick a Brick tem menos peças mas é "oficial"; BrickLink tem tudo mas exige conta e compra de múltiplos vendedores.)
5. **P5 — Manual:** PDF para imprimir, visualização interativa na web, ou ambos? (Ambos dobra o esforço da v2.)
6. **P6 — Nome do produto** e domínio (relevante já na v1 se for publicado no blog).
7. **P7 — Idiomas:** só PT-BR, ou PT+EN desde o início? (Afeta v4 e o manual gerado.)

### Negócio

8. **N1 — Monetização na v4:** gratuito, freemium (X conversões grátis), afiliados de marketplaces de peças, ou venda do manual/set como produto? Afeta decisões de custo desde a v2.
9. **N2 — Orçamento de infraestrutura:** existe teto mensal aceitável para APIs (preços BrickLink, geração 3D na v3) e eventual GPU?
10. **N3 — Posição jurídica:** validar com advogado o uso do termo "LEGO" e a geração de instruções no estilo oficial antes da v4, ou aceitar o risco até lá?
11. **N4 — Conteúdo gerado por usuários (v4):** sets criados são públicos por padrão (efeito rede, galeria) ou privados por padrão (privacidade)?

### Arquitetura

12. **A1 — Onde roda o processamento:** 100% client-side (browser/WASM — zero custo de servidor, limita tamanho dos modelos) vs. backend desde já (mais simples para jobs pesados, custo e infra). Recomendação: client-side na v1, decidir na v2 com benchmarks.
13. **A2 — Stack do front-end:** alguma preferência (React/Svelte/Vue)? O blog atual é estático com Node — sem padrão estabelecido para apps.
14. **A3 — Repositório:** este produto nasce em repo próprio ou dentro deste repo do blog? (Recomendação: repo próprio; este PRD pode migrar junto.)
15. **A4 — Geração de instruções 3D (v2):** integrar LPub3D/ecossistema LDraw via pipeline headless (rápido de entregar, dependência pesada) ou renderizador próprio em three.js (mais controle, mais esforço)?
16. **A5 — Formato canônico interno:** LDraw (.ldr) como representação dos sets (interoperável com todo o ecossistema) — confirmar, pois influencia tudo na v2+.
17. **A6 — Geração 3D na v3:** API de terceiros (Meshy/Tripo — sem infra, custo por geração) vs. modelo open source auto-hospedado (TRELLIS/Hunyuan3D — exige GPU). Recomendação: API na v3.
18. **A7 — Hospedagem v4:** manter ecossistema Cloudflare (Pages/Workers/R2/Queues, alinhado à infra atual do autor) ou outra nuvem por causa de GPU?
19. **A8 — Fonte de catálogo e preços:** Rebrickable dumps + BrickLink Price Guide API (recomendado) — alguém precisa criar/fornecer as API keys.

---

## 11. Sequenciamento sugerido

1. Responder §10 (mínimo: P1–P5, A1–A3).
2. **v1 (MVP):** mosaico no browser com BOM e PDF — valida o funil completo de ponta a ponta com o menor risco técnico.
3. Compra e montagem real de um mosaico (teste da métrica v1).
4. **v2:** voxelização + legolização básica (perfil "Básico") → depois perfis avançados e estabilidade.
5. **v3:** integração de API image-to-3D na frente do pipeline v2.
6. **v4:** contas, fila, limites, publicação.
