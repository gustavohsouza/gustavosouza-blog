# PRD — Conversor de Imagens e Modelos 3D em Sets de LEGO

| Campo | Valor |
|---|---|
| Autor | Gustavo Souza (g@saasholic.com) |
| Status | Decisões principais tomadas em 2026-06-12 — ver §10 (restam poucas questões abertas) |
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

- **Peça base do mosaico:** escolhida pelo usuário via **botões de toggle na UI** — plate 1×1 redonda (estilo LEGO Art) / plate 1×1 quadrada / tile 1×1 — com o preview refletindo a escolha. *(Decidido.)*
- **Quantização no espaço CIELAB** (ΔE) e não RGB, para fidelidade perceptual.
- **Paleta de cores:** derivada do catálogo de cores em produção (fonte: BrickLink/Rebrickable). Cores raras encarecem muito o set — a paleta default deve considerar disponibilidade e preço, não só existência da cor.
- **Merge de peças:** mosaicos só de 1×1 são mais caros e tediosos; agrupar regiões da mesma cor em plates maiores reduz custo (~30–50% em áreas chapadas). Trade-off: manual mais complexo. **Ligado por padrão** (toggle para desligar). *(Decidido.)* Obs.: só se aplica aos modos plate; no modo tile não há merge (tiles maiores mudam o visual da grade).

### 3.3 Entregáveis da conversão

1. **Visualização final** (render do mosaico, comparação lado a lado com a original).
2. **BOM:** tabela peça × cor × quantidade, com preço estimado por item e total.
3. **Arquivo de compra:** lista de compras orientada a **peças compatíveis de fornecedores chineses** (Gobricks e similares, via AliExpress e afins), priorizando lojas com frete grátis ou mais barato — ver §7.1. Export secundário: Wanted List XML do BrickLink (para quem preferir peças originais).
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
- Geração via **renderizador próprio (three.js + biblioteca de geometria LDraw)** *(decidido)* — coerente com a arquitetura 100% navegador/local; LPub3D é aplicação desktop C++ e não se encaixa. Bônus: o mesmo renderizador serve visualização interativa dos passos na web **e** export PDF.
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

- **Modelo de geração 3D** *(direção decidida: custo mínimo)*: preferir modelo **open source rodando na máquina do usuário** (ex.: TripoSR/TRELLIS — exigem GPU modesta), alinhado à arquitetura local-first. Fallback: API de terceiros pay-per-use (ex.: Meshy/Tripo3D, há tiers gratuitos) **limitada ao teto de US$ 10/mês**, com contador de uso na aplicação.
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
│ • Tabela de preços estática (peças compatíveis,     │
│   ver §7.1) + export BrickLink como alternativa     │
│ • (v3) geração image-to-3D (ver §10/A6)             │
└─────────────────────────────────────────────────────┘
```

Observações:

- **Execução local-first** *(decidido)*: a aplicação roda na máquina do usuário — web app estático servido localmente, com **todo o processamento no navegador** (quantização, PDF, e na v2 voxelização/legolização em WASM/workers para modelos médios). Custo de servidor: zero. O mesmo build estático pode ser publicado (Cloudflare Pages) na v4 sem mudança de arquitetura.
- **Catálogo de peças:** Rebrickable fornece dumps completos (peças, cores, relacionamentos) com licença permissiva — usar como base canônica. Os IDs de design LEGO valem também para peças compatíveis (Gobricks etc. usam a mesma numeração/geometria).
- **Stack** *(decidido)*: TypeScript em monorepo — `core/` (engine de conversão, biblioteca pura, sem UI) + `app/` (Vite + React + three.js para o preview 3D da v2). UI em **inglês**.
- **Teto de custo de APIs: US$ 10/mês** *(decidido)* — restringe qualquer dependência de API paga; preferir dados estáticos cacheados e processamento local.

### 7.1 Estratégia de compra e preços (peças compatíveis)

*(Decidido: o catálogo de compra prioriza peças compatíveis de fornecedores chineses — Gobricks e similares via AliExpress e afins — otimizando por frete grátis/mais barato. Peças LEGO originais viram caminho secundário.)*

- **Identificação das peças:** o BOM usa os design IDs padrão (os mesmos da LEGO), que os fabricantes compatíveis também usam — a lista funciona em qualquer fornecedor.
- **Compra:** não existe API pública de preços/estoque para AliExpress. Abordagem:
  1. **Export BrickLink Wanted List XML** — formato amplamente aceito, inclusive por lojas de peças compatíveis que montam pedidos a partir de listas (várias lojas Gobricks aceitam upload de lista de peças);
  2. **Links de busca gerados** por peça+cor para AliExpress (e afins), agrupados por loja sugerida para consolidar frete;
  3. **CSV simples** (part ID, cor, quantidade) para colar em formulários de pedido.
- **Estimativa de preço:** tabela estática de preços por categoria de peça (peças compatíveis custam tipicamente US$ 0,005–0,03/peça), embarcada na aplicação e revisada manualmente de tempos em tempos — sem API paga, dentro do teto de US$ 10/mês. O preço mostrado é estimativa com aviso de variação; opcionalmente o usuário ajusta o preço médio por peça.
- **Frete:** sem API, a otimização de frete é heurística — consolidar a compra no menor número de lojas e sinalizar o peso/quantidade total para o usuário comparar opções de envio.

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
| Custo real do set muito acima da estimativa (tabela de preços estática pode defasar) | Média | Margem de segurança na estimativa; aviso de variação; preço médio ajustável pelo usuário |
| Qualidade/tolerância de peças compatíveis varia entre fabricantes | Baixa | Recomendar fabricantes consolidados (ex.: Gobricks) na UI |
| Custo de GPU/API na v3 | Média | Geração local na GPU do usuário; API só como fallback com teto de US$ 10/mês |

---

## 10. Decisões e questões em aberto

### 10.1 Decisões registradas (2026-06-12)

| # | Questão | Decisão |
|---|---|---|
| P1 | Peça do mosaico (v1) | Escolha do usuário via botões de toggle: plate redonda / plate quadrada / tile |
| P2 | Otimização de custo (merge) | **Ligada por padrão**, com toggle para desligar |
| P3 | Tamanhos do mosaico | Presets 32×32, 48×48, 64×64, 96×96 + campo personalizado (limite prático 128×128 por performance/custo) *(decisão delegada)* |
| P4 | Formato de compra | **Peças compatíveis de fornecedores chineses** (Gobricks e similares via AliExpress e afins), otimizando frete grátis/mais barato; export BrickLink XML como secundário — ver §7.1 |
| P5 | Manual | v1: PDF imprimível. v2: visualização interativa na web + export PDF a partir do mesmo renderizador *(decisão delegada)* |
| P7 | Idiomas | **Somente inglês** (UI e manuais) |
| N1 | Monetização | **Sem monetização** |
| N2 | Orçamento de APIs | **Teto de US$ 10/mês** — favorece dados estáticos e processamento local |
| A1 | Onde roda | **Local-first**: aplicação roda na máquina do usuário, processamento 100% no navegador; mesmo build estático publicável na v4 |
| A2 | Stack | TypeScript, monorepo `core/` + `app/` (Vite + React + three.js) *(decisão delegada)* |
| A3 | Repositório | **Repositório próprio**, separado do blog |
| A4 | Instruções 3D (v2) | **Renderizador próprio em three.js** + geometria LDraw (LPub3D descartado: app desktop, não cabe na arquitetura navegador) *(decisão delegada)* |
| A5 | Formato canônico | **LDraw (.ldr)** como representação interna dos sets *(decisão delegada)* |
| A6 | Geração 3D (v3) | Open source local (GPU do usuário) preferencial; API de terceiros como fallback dentro do teto de US$ 10/mês |
| A7 | Hospedagem v4 | Build estático no Cloudflare Pages (gratuito) *(decisão delegada, coerente com A1)* |
| A8 | Catálogo e preços | Rebrickable dumps (gratuitos) + tabela de preços estática de peças compatíveis (§7.1) — nenhuma API paga |

### 10.2 Ainda em aberto

1. **P6 — Nome do produto:** "Brickify" segue como codinome; nome final e domínio podem ser decididos até a v4 (sem urgência: v1–v3 são locais).
2. **N3 — Posição jurídica (v4):** sem monetização o risco cai bastante, mas antes de publicar (v4) ainda vale revisar o uso do termo "LEGO" na comunicação — usar "compatível com bricks de montar" e citar marcas só nominativamente.
3. **N4 — UGC na v4:** sets públicos ou privados por padrão na galeria. Decidir quando a v4 entrar em planejamento.

---

## 11. Sequenciamento sugerido

1. ~~Responder §10~~ — feito em 2026-06-12 (ver §10.1); criar o repositório próprio do produto (A3).
2. **v1 (MVP):** mosaico no browser com BOM e PDF — valida o funil completo de ponta a ponta com o menor risco técnico.
3. Compra e montagem real de um mosaico (teste da métrica v1).
4. **v2:** voxelização + legolização básica (perfil "Básico") → depois perfis avançados e estabilidade.
5. **v3:** integração de API image-to-3D na frente do pipeline v2.
6. **v4:** contas, fila, limites, publicação.
