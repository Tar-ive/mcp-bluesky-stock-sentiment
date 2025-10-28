```
import { Firehose } from "@atproto/sync";
import { IdResolver } from "@atproto/identity";
import supabase from "./utils/db.js";
const MENTAL_HEALTH_KEYWORDS = [
  "mental health",
  "mental illness",
  "mental disorder",
  "mental breakdown",
  "mental fatigue",
  "psychological",
  "emotional health",
  "emotional support",
  "cognitive therapy",
  "psychotherapy",
  "clinical depression",
  "depression",
  "depressed",
  "hopeless",
  "worthless",
  "numb",
  "empty",
  "crying",
  "grief",
  "mourning",
  "loss",
  "low mood",
  "burnout",
  "anxiety",
  "anxious",
  "panic attack",
  "panic disorder",
  "worry",
  "nervous",
  "overwhelmed",
  "racing thoughts",
  "dread",
  "tension",
  "suicide",
  "suicidal",
  "self harm",
  "cutting",
  "attempted suicide",
  "taking my life",
  "ending it all",
  "thoughts of suicide",
  "hurting myself",
  "ptsd",
  "trauma",
  "flashbacks",
  "hypervigilance",
  "dissociation",
  "emotional numbness",
  "abuse trauma",
  "childhood trauma",
  "sexual trauma",
  "bipolar",
  "ocd",
  "adhd",
  "borderline",
  "schizophrenia",
  "eating disorder",
  "anorexia",
  "bulimia",
  "personality disorder",
  "therapy",
  "counseling",
  "counsellor",
  "therapist",
  "psychologist",
  "psychiatrist",
  "meds",
  "mental health treatment",
  "support group",
  "recovery",
  "mental health app",
  "insomnia",
  "sleep disorder",
  "can’t sleep",
  "racing mind",
  "stressed",
  "stress",
  "burned out",
  "sleep paralysis",
  "i want to die",
  "i want to end it",
  "i can’t do this anymore",
  "life isn’t worth it",
  "no reason to live",
  "ending my life",
];

// Precompile keyword regexes
const mentalHealthRegexes = MENTAL_HEALTH_KEYWORDS.map(
  (kw) =>
    new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i")
);

function isMentalHealthPost(text = "") {
  return mentalHealthRegexes.some((regex) => regex.test(text));
}
// === Insert Queue Config ===
const INSERT_BATCH_SIZE = 100;
const INSERT_INTERVAL_MS = 5000;
const MAX_QUEUE_LENGTH = 1000;
const MAX_RETRIES = 3;

let insertQueue = [];
let isInserting = false;

// // === Optional: Memory Monitor ===
// setInterval(() => {
//   const mem = process.memoryUsage();
//   console.log(`[MEMORY] RSS: ${(mem.rss / 1024 / 1024).toFixed(2)}MB`);
// }, 60000);

// === Flush Queue Safely ===
const flushQueue = async () => {
  if (insertQueue.length === 0 || isInserting) return;

  isInserting = true;
  const batch = insertQueue.splice(0, INSERT_BATCH_SIZE);

  try {
    const { error } = await supabase.from("posts_unlabeled").insert(batch);
    if (error) {
      console.error("❌ Supabase batch insert error:", error.message);
      // Mark retries and requeue if within limit
      batch.forEach((item) => {
        item._retries = (item._retries || 0) + 1;
      });
      const retryable = batch.filter((item) => item._retries <= MAX_RETRIES);
      if (retryable.length > 0) {
        insertQueue.unshift(...retryable);
      }
    } else {
      console.log(`✅ Inserted batch of ${batch.length}`);
    }
  } catch (err) {
    console.error("🔥 Unexpected insert error:", err.stack || err);
    batch.forEach((item) => {
      item._retries = (item._retries || 0) + 1;
    });
    const retryable = batch.filter((item) => item._retries <= MAX_RETRIES);
    if (retryable.length > 0) {
      insertQueue.unshift(...retryable);
    }
  }

  isInserting = false;

  // Truncate queue if too large
  if (insertQueue.length > MAX_QUEUE_LENGTH) {
    insertQueue = insertQueue.slice(-MAX_QUEUE_LENGTH);
  }
};

setInterval(flushQueue, INSERT_INTERVAL_MS);

// === Graceful Shutdown ===
process.on("SIGINT", async () => {
  console.log("🛑 Shutting down — flushing remaining posts...");
  await flushQueue();
  process.exit(0);
});

// === Firehose Setup ===
const idResolver = new IdResolver();
let firehoseStarted = false;

const firehose = new Firehose({
  service: "wss://bsky.network",
  idResolver,
  filterCollections: ["app.bsky.feed.post"],

  handleEvent: async (evt) => {
    try {
      if (evt.event !== "create") return;
      const post = evt.record;
      if (!post?.text || post.reply) return;
      if (post?.$type !== "app.bsky.feed.post") return;
      if (!isMentalHealthPost(post.text)) return;
      if (!evt.did) return;

      const record = {
        uri: evt.uri.toString(),
        did: evt.did,
        text: post.text,
        created_at: post.createdAt || evt.time,
        langs: post.langs || [],
        facets: post.facets || null,
        reply: null,
        embed: post.embed || null,
        ingestion_time: new Date().toISOString(),
      };

      insertQueue.push(record);

      if (insertQueue.length >= INSERT_BATCH_SIZE * 2) {
        console.log("⚠️ Queue large — flushing early...");
        await flushQueue();
      }
    } catch (err) {
      console.error("🔥 Event handler error:", err.stack || err);
    }
  },

  onError: (err) => {
    console.error("🔥 Firehose stream error:", err.stack || err);
  },
});

if (!firehoseStarted) {
  firehoseStarted = true;
  firehose.start();
  console.log("🚀 Firehose started.");
}
```

```python 
STOCK_KEYWORDS = [
    "stock", "stocks", "equity", "equities", "invest", "investment", "investing",
    "buy", "sell", "bull", "bear", "market", "ticker", "finance", "trading", "portfolio",
    "nasdaq", "nyse", "dow", "s&p", "earnings", "ipo", "dividend", "split", "buyback",
    "analyst", "upgrade", "downgrade", "quarterly", "profit", "loss", "option", "call", "put"
]
import re
stock_regexes = [re.compile(rf"\b{re.escape(kw)}\b", re.IGNORECASE) for kw in STOCK_KEYWORDS]

def is_stock_post(text):
    return any(rx.search(text or "") for rx in stock_regexes)
    from atproto import FirehoseSubscribeReposClient, parse_subscribe_repos_message, models, CAR

def on_message_handler(message):
    commit = parse_subscribe_repos_message(message)
    if not isinstance(commit, models.ComAtprotoSyncSubscribeRepos.Commit):
        return
    if not commit.blocks:
        return

    car = CAR.from_bytes(commit.blocks)
    for op in commit.ops:
        if op.action == "create" and op.cid:
            data = car.blocks.get(op.cid)
            if data.get("$type") == "app.bsky.feed.post":
                text = data.get("text", "")
                if is_stock_post(text) and not data.get("reply"):  # Exclude replies
                    print(f"Stock Post: {text} | Author: {data.get('creator')}")
                    # Optionally, append to a batch list for later insertion (e.g. into Supabase)

client = FirehoseSubscribeReposClient()
client.start(on_message_handler)

```