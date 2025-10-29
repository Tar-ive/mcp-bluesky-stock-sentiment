import * as cbor from "@ipld/dag-cbor";
import { isStockPost } from "./stock-filter";

export interface StockPost {
  text: string;
  author: string;
  did: string;
  uri: string;
  createdAt: string;
}

interface FirehoseHeader {
  op: number;
  t: string;
}

interface FirehoseCommit {
  repo: string;
  ops: Array<{
    action: string;
    path: string;
    cid?: any;
  }>;
  blocks: Uint8Array;
}

export async function collectStockPosts(
  count: number = 2,
  timeoutMs: number = 30000
): Promise<StockPost[]> {
  const posts: StockPost[] = [];
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log(`Timeout reached. Collected ${posts.length} posts.`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      resolve(posts);
    }, timeoutMs);

    let ws: WebSocket;
    
    try {
      ws = new WebSocket("wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos");
      ws.binaryType = "arraybuffer";
      
      ws.onopen = () => {
        console.log("Connected to Bluesky firehose");
      };

      ws.onmessage = async (event) => {
        try {
          if (event.data instanceof ArrayBuffer) {
            const buffer = new Uint8Array(event.data);
            
            // Decode CBOR header
            const header = cbor.decode(buffer) as FirehoseHeader;
            
            if (header.t === "#commit") {
              // Skip header bytes and decode the commit payload
              const headerLength = cbor.encode(header).length;
              const commitData = buffer.slice(headerLength);
              const commit = cbor.decode(commitData) as FirehoseCommit;
              
              await processCommit(commit, posts, count, ws, timeout, resolve);
            }
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

async function processCommit(
  commit: FirehoseCommit,
  posts: StockPost[],
  count: number,
  ws: WebSocket,
  timeout: NodeJS.Timeout,
  resolve: (value: StockPost[]) => void
) {
  for (const op of commit.ops) {
    if (op.action === "create" && op.path.includes("app.bsky.feed.post")) {
      try {
        // Decode the CAR blocks to get the post record
        const blocks = cbor.decode(commit.blocks);
        const post = blocks[op.cid?.toString()];
        
        if (post?.text && !post.reply && isStockPost(post.text)) {
          const stockPost: StockPost = {
            text: post.text,
            author: commit.repo,
            did: commit.repo,
            uri: `at://${commit.repo}/${op.path}`,
            createdAt: post.createdAt || new Date().toISOString()
          };
          
          posts.push(stockPost);
          console.log(`Collected stock post ${posts.length}/${count}: "${post.text.substring(0, 50)}..."`);
          
          if (posts.length >= count) {
            clearTimeout(timeout);
            ws.close();
            resolve(posts);
            return;
          }
        }
      } catch (err) {
        console.error("Error decoding post record:", err);
      }
    }
  }
}
