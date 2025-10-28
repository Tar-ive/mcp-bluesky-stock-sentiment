import { isStockPost } from "./stock-filter";

export interface StockPost {
  text: string;
  author: string;
  did: string;
  uri: string;
  createdAt: string;
}

export async function collectStockPosts(
  count: number = 1,
  timeoutMs: number = 30000
): Promise<StockPost[]> {
  const posts: StockPost[] = [];
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log(`Timeout reached. Collected ${posts.length} posts.`);
      resolve(posts);
    }, timeoutMs);

    let ws: WebSocket;
    
    try {
      ws = new WebSocket("wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos");
      
      ws.onopen = () => {
        console.log("Connected to Bluesky firehose");
      };

      ws.onmessage = (event) => {
        try {
          if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);
            processFirehoseMessage(data, posts, count, ws, timeout, resolve);
          } else if (event.data instanceof ArrayBuffer) {
            const decoder = new TextDecoder();
            const text = decoder.decode(event.data);
            const data = JSON.parse(text);
            processFirehoseMessage(data, posts, count, ws, timeout, resolve);
          }
        } catch (err) {
          console.error("Error parsing firehose message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        clearTimeout(timeout);
        ws.close();
        reject(new Error("WebSocket connection failed"));
      };

      ws.onclose = () => {
        console.log("Firehose connection closed");
        clearTimeout(timeout);
        resolve(posts);
      };
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

function processFirehoseMessage(
  data: any,
  posts: StockPost[],
  count: number,
  ws: WebSocket,
  timeout: NodeJS.Timeout,
  resolve: (value: StockPost[]) => void
) {
  if (data.commit?.ops) {
    for (const op of data.commit.ops) {
      if (op.action === "create" && op.path?.includes("app.bsky.feed.post")) {
        const post = op.record;
        
        if (post?.text && !post.reply && isStockPost(post.text)) {
          const stockPost: StockPost = {
            text: post.text,
            author: data.repo || "unknown",
            did: data.repo,
            uri: `at://${data.repo}/${op.path}`,
            createdAt: post.createdAt || new Date().toISOString()
          };
          
          posts.push(stockPost);
          console.log(`Collected stock post ${posts.length}/${count}: "${post.text.substring(0, 50)}..."`);
          
          if (posts.length >= count) {
            clearTimeout(timeout);
            ws.close();
            resolve(posts);
          }
        }
      }
    }
  }
}
