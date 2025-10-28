import { McpServer } from "mcp-lite";
import { z } from "zod";
import { collectStockPosts } from "../lib/firehose";
import { analyzeSentiment } from "../lib/sentiment";

export function registerStockTools(mcp: McpServer) {
  mcp.tool("analyze_stock_posts", {
    description: "Tap into Bluesky firehose, collect stock-related posts in real-time, and analyze sentiment using Cloudflare AI",
    inputSchema: z.object({
      count: z.number().min(1).max(10).default(2).describe("Number of stock posts to collect from the live stream"),
      timeoutSeconds: z.number().min(5).max(60).default(30).describe("Maximum time (in seconds) to wait for collecting posts"),
    }),
    handler: async (args, ctx) => {
      const { count, timeoutSeconds } = args;
      
      console.log(`Starting firehose collection: ${count} posts, ${timeoutSeconds}s timeout`);
      
      try {
        const posts = await collectStockPosts(count, timeoutSeconds * 1000);
        
        if (posts.length === 0) {
          return {
            content: [{
              type: "text",
              text: "⏱️ No stock-related posts found in the time window. The Bluesky firehose may be slow, or stock activity is low. Try increasing the timeout or try again later."
            }]
          };
        }
        
        const analyzed = await Promise.all(
          posts.map(async (post) => {
            const sentiment = await analyzeSentiment(post.text, ctx.env.AI);
            return {
              ...post,
              sentiment: sentiment.label,
              confidence: sentiment.score
            };
          })
        );
        
        const positive = analyzed.filter(p => p.sentiment === "POSITIVE").length;
        const negative = analyzed.filter(p => p.sentiment === "NEGATIVE").length;
        const avgConfidence = analyzed.reduce((sum, p) => sum + p.confidence, 0) / analyzed.length;
        
        const summary = `
📊 **Stock Sentiment Analysis from Bluesky Firehose**
${"=".repeat(55)}

**Summary:**
- Total Posts Analyzed: ${analyzed.length}
- Positive Sentiment: ${positive} (${((positive / analyzed.length) * 100).toFixed(1)}%)
- Negative Sentiment: ${negative} (${((negative / analyzed.length) * 100).toFixed(1)}%)
- Average Confidence: ${(avgConfidence * 100).toFixed(1)}%

**Detailed Posts:**
${analyzed.map((p, i) => `
${i + 1}. **${p.sentiment}** (${(p.confidence * 100).toFixed(1)}% confident)
   👤 Author: ${p.author}
   📝 Text: "${p.text.length > 200 ? p.text.substring(0, 200) + '...' : p.text}"
   🕒 Posted: ${new Date(p.createdAt).toLocaleString()}
   🔗 URI: ${p.uri}
`).join('\n---\n')}
        `.trim();
        
        return {
          content: [{
            type: "text",
            text: summary
          }]
        };
      } catch (error) {
        console.error("Error in analyze_stock_posts:", error);
        return {
          content: [{
            type: "text",
            text: `❌ Error analyzing stock posts: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  });
}
