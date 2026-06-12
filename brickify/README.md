# Brickify

Turn images and 3D models into buildable brick sets — with a parts list you can
actually order and a step-by-step instruction manual. Everything runs locally in
your browser; there is no server.

> Brickify is not affiliated with the LEGO Group. LEGO® is a trademark of the
> LEGO Group. Price estimates assume LEGO-compatible bricks (Gobricks and
> similar), bought via AliExpress-style stores; part numbers are the standard
> design ids, so the lists also work with original parts on BrickLink.

## Apps

| App | What it does |
|---|---|
| **Mosaic** (`apps/mosaic`) — v1 | 2D image → brick mosaic. Crop/zoom, sizes up to 128×128 studs, round plates / square plates / tiles toggle, palettes, dithering, cost-optimizing plate merge, BOM, BrickLink XML, CSV, AliExpress links and a printable LEGO-Art-style PDF manual. |
| **Studio** (`apps/studio`) — v2 | 3D model (STL/OBJ/GLB/GLTF) → brick set. Voxelization, brick-bonded layout with automatic internal supports, piece profiles (basic/standard/advanced), hollow interior, 38 colors, interactive 3D preview with layer step-through, `.ldr` export and a step-by-step PDF manual. |
| **Imagine** (`apps/imagine`) — v3 | Photo/drawing → AI-generated 3D model (Meshy API, bring your own key) → approve the mesh → same brick pipeline as Studio. Includes a local monthly generation cap to protect your budget and a mesh-upload fallback. |

## Packages

- `packages/core` — pure TypeScript conversion engine (no DOM, fully unit-tested):
  color palette with CIELAB matching, parts catalog with compatible-brick price
  estimates, mosaic quantization + plate merge, BOM, exporters, voxelizer,
  legolizer with connectivity analysis, LDraw writer.
- `packages/brick3d` — shared three.js components: mesh loaders, instanced brick
  viewer, offscreen renderer and the 3D instruction-manual generator.

## Develop

```sh
npm install
npm test               # core engine tests
npm run dev:mosaic     # v1 on http://localhost:5173
npm run dev:studio     # v2
npm run dev:imagine    # v3
npm run build          # builds all three apps to apps/*/dist
```

Each app builds to a fully static bundle — host the `dist/` folders anywhere
(Cloudflare Pages, GitHub Pages, a local file server).

## Using Imagine (v3)

1. Get an API key at meshy.ai (free tier available) and paste it in the app —
   it is stored only in your browser's localStorage.
2. If your browser blocks the API call (CORS), set a proxy base URL in
   "Advanced", or skip generation and upload an STL/OBJ/GLB directly.
3. The app refuses to start more than 25 generations per month by default
   (`MONTHLY_CAP` in `apps/imagine/src/meshy.ts`).
