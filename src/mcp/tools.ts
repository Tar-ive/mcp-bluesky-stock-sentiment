import { McpServer } from "mcp-lite";
import { z } from "zod";
import { searchStockPosts } from "../lib/bluesky-api";
import { analyzeSentiment } from "../lib/sentiment";

export function registerStockTools(mcp: McpServer) {
  mcp.tool("analyze_stock_posts", {
    description: "Search Bluesky for recent stock-related posts and analyze sentiment using Cloudflare AI",
    inputSchema: z.object({
      count: z.number().min(1).max(10).default(2).describe("Number of recent stock posts to analyze"),
    }),
    handler: async (args, ctx) => {
      const { count } = args;
      
      console.log(`Searching for ${count} recent stock posts...`);
      
      try {
        const posts = await searchStockPosts(count);
        
        if (posts.length === 0) {
          return {
            content: [{
              type: "text",
              text: "📭 No stock-related posts found in recent Bluesky activity. Stock discussions may be quiet right now. Try again later."
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
📊 **Stock Sentiment Analysis from Bluesky**
${"=".repeat(50)}

**Summary:**
- Total Posts Analyzed: ${analyzed.length}
- Positive Sentiment: ${positive} (${((positive / analyzed.length) * 100).toFixed(1)}%)
- Negative Sentiment: ${negative} (${((negative / analyzed.length) * 100).toFixed(1)}%)
- Average Confidence: ${(avgConfidence * 100).toFixed(1)}%

**Detailed Posts:**
${analyzed.map((p, i) => `
${i + 1}. **${p.sentiment}** (${(p.confidence * 100).toFixed(1)}% confident)
   👤 Author: ${p.authorHandle || p.author}
   📝 Text: "${p.text.length > 200 ? p.text.substring(0, 200) + '...' : p.text}"
   💙 ${p.likeCount || 0} likes | 🔄 ${p.repostCount || 0} reposts
   🕒 Posted: ${new Date(p.createdAt).toLocaleString()}
   🔗 ${p.uri}
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
