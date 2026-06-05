# Memo Updater Dashboard

Phase 1 scaffold of a buy-side investment research dashboard that takes an existing memo plus new update material and produces a follow-up memo in the same house style. Runs on Cloudflare Workers (not Pages) with a React + Vite + TypeScript SPA served via the Workers Static Assets binding.

## Phase 1 status

Foundation only. No real LLM calls, no real PDF parsing, no real R2 / D1 / Queues persistence. Every screen runs on mock RateGain demo data so the full intake → DNA → builder → output flow is walkable end-to-end. Placeholder bindings for R2, D1, Queues, and Workflows are kept commented in `wrangler.jsonc` so Phase 2 wiring is mechanical.

## Tech stack

- React 19 + Vite 7 + TypeScript 5
- `@cloudflare/vite-plugin` (unified dev server with the Workers runtime + HMR)
- Hono on the Worker for `/api/*` routes
- Tailwind CSS v4 via `@tailwindcss/vite` (CSS-based theming with `@theme`, no `tailwind.config.js`)
- `react-router-dom` v7 for SPA routing
- `lucide-react` for icons; `clsx` + `tailwind-merge` for class composition

## Folder layout

```
src/
├── react-app/      # frontend (Vite/React)
│   ├── components/{layout,ui}
│   ├── pages/
│   ├── lib/{api,cn}.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── shared/         # imported by BOTH the React app and the Worker
│   ├── types.ts
│   └── demo/rategain-*.ts
└── worker/         # Cloudflare Worker entry (Hono)
    └── index.ts
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with the Workers runtime + HMR (`localhost:5173`) |
| `npm run build` | `tsc -b && vite build` → emits `dist/client/` (SPA) and `dist/memo-updater/` (Worker bundle) |
| `npm run preview` | Builds, then runs the production bundle through the real Workers runtime locally |
| `npm run deploy` | `npm run build && wrangler deploy` |
| `npm run cf-typegen` | Re-runs `wrangler types` to refresh `worker-configuration.d.ts` |
| `npm run typecheck` | `tsc -b --noEmit` across `app`, `node`, and `worker` projects |
| `npm run lint` | `eslint .` |
| `npm run check` | Pre-push gate: typecheck + build + `wrangler deploy --dry-run` |

## API routes (mock)

| Route | Returns |
|---|---|
| `GET /api/health` | `{ status: "ok", phase: "1-demo", timestamp }` |
| `GET /api/demo/project` | `MemoProject` |
| `GET /api/demo/memo-dna` | `MemoDNA` |
| `GET /api/demo/follow-up-memo` | `FollowUpMemo` |

## Cloudflare deployment settings

When connecting this repo via Workers Builds in the Cloudflare dashboard:

- **Project type**: Workers (not Pages)
- **Build command**: `npm run build`
- **Deploy command**: `npx wrangler deploy`
- **Root directory**: `/`
- **Output directory**: leave blank (the Vite plugin auto-wires `assets.directory`)
- **Install command**: `npm ci`
- **Node version**: 20 or 22 LTS

## Phase 2 hooks

Commented bindings are already in `wrangler.jsonc`:

- `r2_buckets` — `MEMO_UPLOADS`
- `d1_databases` — `DB`
- `queues` — `MEMO_QUEUE`
- `workflows` — `MEMO_WORKFLOW`
- Secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (set via `wrangler secret put`, never committed)

Uncomment, run `npm run cf-typegen`, then start filling in real handlers in `src/worker/index.ts` (TODO comments mark the slots).
