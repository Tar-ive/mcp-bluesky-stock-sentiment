const STOCK_KEYWORDS = [
  "stock", "stocks", "equity", "equities", "invest", "investment", "investing",
  "buy", "sell", "bull", "bear", "market", "ticker", "finance", "trading", 
  "portfolio", "nasdaq", "nyse", "dow", "s&p", "earnings", "ipo", "dividend", 
  "split", "buyback", "analyst", "upgrade", "downgrade", "quarterly", 
  "profit", "loss", "option", "call", "put", "crypto", "bitcoin", "eth",
  "wallstreet", "wall street", "stock market", "shares", "shareholder", 
  "BTC" , "AAPL", "Apple", "NVIDIA", "NVDA"
];


const stockRegexes = STOCK_KEYWORDS.map(
  (kw) => new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i")
);

export function isStockPost(text: string): boolean {
  if (!text) return false;
  return stockRegexes.some((regex) => regex.test(text));
}
