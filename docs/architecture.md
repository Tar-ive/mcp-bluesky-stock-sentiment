# Architecture Overview

This diagram shows how the Bluesky Stock Sentiment MCP server is wired end‑to‑end.

```mermaid
flowchart TD
  A["MCP Client\n(e.g., Claude Desktop)"] -->|"HTTP MCP (/mcp)\nStreamableHttpTransport"| B["Cloudflare Worker\n(Hono + mcp-lite)"]
  B -->|invoke tool| C["Tool: analyze_stock_posts"]
  C -->|search terms| D["Bluesky Search API\n(@atproto/api)"]
  C -->|filter text| E["Stock filter\n(keywords/regex)"]
  C -->|analyze text| F["Workers AI\n(@cf/huggingface/distilbert-sst-2-int8)"]
  F -->|label + score| C
  C -->|summary text| B
  B -->|MCP content| A

  %% Optional real-time collection (reference implementation)
  C -. optional .-> G[("Bluesky Firehose\n(WebSocket)")]

  classDef node fill:#eef,stroke:#58a,stroke-width:1px,color:#111;
  classDef service fill:#efe,stroke:#5a8,stroke-width:1px,color:#111;
  class A,B,C,E node;
  class D,F,G service;
```

Key files
- `src/index.ts` — Hono app, MCP server wiring, and routes.
- `src/mcp/tools.ts` — Registers `analyze_stock_posts` and implements handler.
- `src/lib/bluesky-api.ts` — Queries Bluesky search for recent posts.
- `src/lib/stock-filter.ts` — Heuristic keyword/regex filtering for stock posts.
- `src/lib/sentiment.ts` — Workers AI sentiment classification.

Notes
- The MCP endpoint is served at `/mcp` using `mcp-lite` over HTTP.
- Workers AI runs the `@cf/huggingface/distilbert-sst-2-int8` text classification model by default.
- The firehose collector is an optional reference and not wired into the Worker route.
