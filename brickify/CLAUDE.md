# CLAUDE.md — Brickify project context

Read this first. It carries the full context from the session that built v1–v3
(June 2026, PR gustavohsouza/gustavosouza-blog#1).

## What this is

Brickify converts images and 3D models into buildable brick sets: the design,
a purchasable parts list (BOM) and a step-by-step instruction manual. Owner:
Gustavo Souza (g@saasholic.com). Full PRD lives in `docs/prd-conversor-lego.md`
in the blog repo (migrate it here alongside this folder).

## Roadmap and status

| Version | Scope | Status |
|---|---|---|
| v1 `apps/mosaic` | 2D image → mosaic | **Done**, browser-verified |
| v2 `apps/studio` | 3D file → brick set | **Done**, browser-verified |
| v3 `apps/imagine` | photo → AI 3D (Meshy) → brick set | **Done** (AI path verified against a mocked API; needs a real Meshy key for live testing) |
| v4 | public multi-user web | **Not started — do not build unless Gustavo asks** |

## Decisions already made (do not re-litigate)

- **English-only UI.** No monetization. API spend ceiling: **US$ 10/month**.
- **Local-first:** everything runs client-side in the browser; static builds;
  zero server cost. v4 would deploy the same static bundles (Cloudflare Pages).
- **Parts purchasing targets LEGO-compatible bricks** (Gobricks etc. via
  AliExpress-style stores), optimizing for cheap/free shipping. BrickLink XML
  export kept as secondary path. No paid pricing APIs — static price table in
  `packages/core/src/parts.ts`, user-adjustable multiplier in the UIs.
- Mosaic piece type is a **user toggle** (round plate / square plate / tile);
  cost-optimizing plate merge **on by default**; 32×32 baseplates included in BOM.
- Stack: TypeScript, npm workspaces, Vite + React + three.js, jsPDF, vitest.
- LDraw (.ldr) is the canonical 3D export; instructions rendered with our own
  three.js renderer (LPub3D rejected: desktop app, doesn't fit the browser).
- v3 generation: Meshy API with user-provided key (localStorage), monthly soft
  cap `MONTHLY_CAP=25` in `apps/imagine/src/meshy.ts`, CORS-proxy override
  field, and mesh-upload fallback.
- Product name "Brickify" is a **codename**; final name undecided (open).
- Other open questions (v4-only): LEGO trademark legal review before going
  public; user gallery default visibility.

## Architecture

- `packages/core` — pure TS engine, no DOM. Palette (38 colors, CIELAB
  matching), parts catalog + prices, mosaic quantization/dither/merge,
  voxelizer (surface sampling + exterior flood-fill; optional per-triangle
  colors with majority vote per voxel), legolizer (brick bonding, color-aware
  cover, auto support columns, seam-stitching repair pass, connectivity
  union-find), BOM, exporters (BrickLink XML, CSV, AliExpress links, LDraw).
  **16 unit tests** (`npm test`). Keep this package dependency-free.
- `packages/brick3d` — shared three.js layer: STL/OBJ/GLB loaders with color
  extraction (vertex colors / UV-sampled textures / material color), instanced
  brick viewer with studs, offscreen scene for renders, 3D manual PDF
  (one layer per step + part callouts).
- `apps/*` — three independent Vite/React apps consuming the packages via
  source aliases (see each `vite.config.ts`).

## Conventions

- Apps must keep working fully offline/static (no server assumptions).
- Every conversion feature ends with: BOM + purchase export + manual.
- Verify changes in a real browser (Playwright + Chromium; see the verify
  scripts pattern: upload fixture → convert → assert downloads, console clean).
- Trademark care: always "LEGO-compatible bricks", never imply affiliation;
  keep the footer disclaimers.

## Migration & next steps

1. This folder (`brickify/`) plus `docs/prd-conversor-lego.md` were developed
   in `gustavohsouza/gustavosouza-blog` branch `claude/lego-converter-prd-294w8f`
   (PR #1) because that session couldn't create repos. Migrate both into the
   dedicated `brickify` repo (this one), make `brickify/`'s contents the repo
   root, then close PR #1 (or strip the brickify folder from it, keeping the PRD
   commits in the blog if Gustavo prefers).
2. After migration: `npm install && npm test && npm run build` must pass.
3. Worthwhile future work (pre-v4): custom per-color palette picker in Mosaic;
   Web Workers for big conversions; real-photo end-to-end test of v3 with a
   live Meshy key; physical build test of a mosaic (PRD success metric v1).
