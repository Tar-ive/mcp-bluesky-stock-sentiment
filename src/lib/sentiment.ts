export interface SentimentResult {
  label: "POSITIVE" | "NEGATIVE";
  score: number;
}

export async function analyzeSentiment(
  text: string,
  AI: Ai
): Promise<SentimentResult> {
  try {
    const result = await AI.run("@cf/huggingface/distilbert-sst-2-int8", {
      text: text
    });
    return result[0] as SentimentResult;
  } catch (error) {
    console.error("Sentiment analysis error:", error);
    return { label: "POSITIVE", score: 0.5 };
  }
}
