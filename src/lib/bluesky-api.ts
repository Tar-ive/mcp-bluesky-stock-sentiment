import { BskyAgent } from "@atproto/api";
import { isStockPost } from "./stock-filter";

export interface StockPost {
  text: string;
  author: string;
  authorHandle: string;
  did: string;
  uri: string;
  createdAt: string;
  likeCount?: number;
  repostCount?: number;
}

const agent = new BskyAgent({
  service: "https://api.bsky.app",
});

const STOCK_SEARCH_TERMS = [
  "stock market",
  "stocks",
  "trading",
  "investing",
  "bull market",
  "bear market",
  "portfolio",
  "nasdaq",
  "dow jones"
];

export async function searchStockPosts(count: number = 2): Promise<StockPost[]> {
  const posts: StockPost[] = [];
  const seenUris = new Set<string>();
  
  for (const term of STOCK_SEARCH_TERMS.slice(0, 3)) {
    if (posts.length >= count) break;
    
    try {
      const response = await agent.app.bsky.feed.searchPosts({
        q: term,
        limit: Math.min(count * 2, 25),
        sort: "latest"
      });
      
      if (response.data.posts && Array.isArray(response.data.posts)) {
        for (const postData of response.data.posts) {
          if (posts.length >= count) break;
          if (seenUris.has(postData.uri)) continue;
          
          const text = postData.record?.text || "";
          if (!text || !isStockPost(text)) continue;
          
          const post: StockPost = {
            text,
            author: postData.author?.displayName || postData.author?.handle || "unknown",
            authorHandle: postData.author?.handle || "unknown",
            did: postData.author?.did || "unknown",
            uri: postData.uri,
            createdAt: postData.record?.createdAt || postData.indexedAt || new Date().toISOString(),
            likeCount: postData.likeCount || 0,
            repostCount: postData.repostCount || 0
          };
          
          posts.push(post);
          seenUris.add(postData.uri);
          console.log(`Found stock post ${posts.length}/${count}: "${text.substring(0, 60)}..."`);
        }
      }
    } catch (err) {
      console.error(`Error searching for "${term}":`, err);
    }
  }
  
  return posts;
}
