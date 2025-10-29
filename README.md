MCP Bluesky Stock Sentiment

Analyze recent Bluesky posts about stocks and return a concise sentiment summary using Cloudflare Workers AI — exposed as an MCP server you can connect to from any MCP‑compatible client.

What you get
- Cloudflare Worker with Hono, serving an MCP endpoint at `/mcp`.
- Tool: `analyze_stock_posts` — searches recent Bluesky posts, filters for stock‑related content, and runs sentiment via `@cf/huggingface/distilbert-sst-2-int8`.
- Simple JSON metadata on `/` for quick health checks.

Quickstart
- Prereqs: Node 18+, Cloudflare account, Wrangler auth (`npx wrangler login`).
- Install: `npm install`
- Dev: `npm run dev` (serves on `http://localhost:8787`)
- Deploy: `npm run deploy`
- Typegen: `npm run cf-typegen` (optional; syncs Worker bindings types)

MCP Endpoint
- Local: `http://localhost:8787/mcp`
- Prod: `<your-workers-subdomain>.workers.dev/mcp`
- Server name: `bluesky-stock-sentiment` (see `src/index.ts`).

Available Tool
- `analyze_stock_posts`
  - Input: `{ count?: number }` — number of posts to analyze (1–10, default 2)
  - Behavior: Fetches recent posts from Bluesky’s public search API, filters to stock‑related text, analyzes each with Workers AI, and returns a textual summary (totals, percentages, average confidence, and per‑post details with author, likes, reposts, timestamp, and URI).

Config and Extensibility
- Sentiment model: `src/lib/sentiment.ts`
  - Default: `@cf/huggingface/distilbert-sst-2-int8`
  - Swap to any Workers AI text‑classification model if you prefer.
- Stock filtering: `src/lib/stock-filter.ts`
  - Update the keyword list to fine‑tune what counts as a “stock post”.
- Bluesky search: `src/lib/bluesky-api.ts`
  - Uses the public unauthenticated search API and basic heuristics to avoid duplicates.
- Firehose (optional): `src/lib/firehose.ts`
  - Example collector that connects to Bluesky’s firehose via WebSocket and filters in real time. This is not wired into the Worker route; use it as a reference for server/runtime environments that support outbound WebSocket connections.

Endpoints
- `GET /` — returns service metadata (name, version, description, available tools).
- `ALL /mcp` — MCP over HTTP transport (via `mcp-lite`). Point your MCP client here.

Notes
- You must bind Workers AI in Wrangler (already configured in `wrangler.jsonc` under `ai.binding = "AI"`).
- Bluesky’s public search API may rate‑limit or change behavior; the tool is resilient but results vary over time.

Project Layout
- `src/index.ts` — Hono app, MCP server wiring, routes.
- `src/mcp/tools.ts` — `analyze_stock_posts` tool registration and handler.
- `src/lib/*` — sentiment analysis, filtering, Bluesky integrations.

License
- Provided as‑is; add a license if you plan to distribute.
