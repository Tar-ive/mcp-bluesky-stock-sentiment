import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { z } from "zod";
import { registerStockTools } from "./mcp/tools";

interface Env {
  AI: Ai;
}

const mcp = new McpServer({
  name: "bluesky-stock-sentiment",
  version: "1.0.0",
  schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
});

// Store env globally so tools can access it
let globalEnv: Env;

registerStockTools(mcp);

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);

const app = new Hono<{ Bindings: Env }>();

app.all("/mcp", async (c) => {
  // Store env so tools can access it
  globalEnv = c.env;
  const response = await httpHandler(c.req.raw);
  return response;
});

// Export globalEnv so tools can import it
export { globalEnv };

app.get("/", (c) => {
  return c.json({
    name: "Bluesky Stock Sentiment MCP Server",
    version: "1.0.0",
    description: "Tap into Bluesky firehose to analyze stock sentiment in real-time",
    endpoints: {
      mcp: "/mcp"
    },
    tools: [
      {
        name: "analyze_stock_posts",
        description: "Collect and analyze stock-related posts from Bluesky firehose"
      }
    ]
  });
});

export default app;
