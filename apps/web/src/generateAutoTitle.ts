/**
 * Maximum number of recent user prompts to consider when generating an auto-title.
 */
const MAX_PROMPTS_FOR_TITLE = 5;

/**
 * Maximum number of words in the generated title.
 */
const MAX_TITLE_WORDS = 4;

/**
 * Common filler/stop words that add little meaning to a title.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "it",
  "to",
  "in",
  "of",
  "for",
  "on",
  "and",
  "or",
  "but",
  "with",
  "that",
  "this",
  "be",
  "are",
  "was",
  "were",
  "been",
  "has",
  "have",
  "had",
  "do",
  "does",
  "did",
  "can",
  "could",
  "would",
  "should",
  "will",
  "shall",
  "may",
  "might",
  "i",
  "me",
  "my",
  "we",
  "you",
  "your",
  "he",
  "she",
  "his",
  "her",
  "its",
  "our",
  "their",
  "them",
  "some",
  "any",
  "all",
  "each",
  "every",
  "no",
  "not",
  "so",
  "if",
  "as",
  "at",
  "by",
  "from",
  "up",
  "out",
  "into",
  "then",
  "than",
  "too",
  "very",
  "just",
  "also",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "why",
  "about",
  "please",
  "thanks",
  "thank",
  "hi",
  "hello",
  "hey",
  "sure",
  "ok",
  "okay",
  "yes",
  "yeah",
  "now",
  "here",
  "there",
  "let",
  "make",
  "need",
  "want",
  "like",
  "get",
  "got",
  "go",
  "going",
  "know",
  "think",
  "see",
  "look",
  "try",
]);

/**
 * Generates a short automatic thread title (up to {@link MAX_TITLE_WORDS} words)
 * from the most recent user messages.
 *
 * Strategy:
 * 1. Collect the first meaningful line from each user message (up to 5).
 * 2. Extract significant words (skip stop words / filler).
 * 3. Keep the first {@link MAX_TITLE_WORDS} significant words, capitalised.
 *
 * When fewer than 2 significant words can be extracted, falls back to the
 * first few words of the first message verbatim.
 */
export function generateAutoTitle(
  userMessages: ReadonlyArray<{ readonly text: string }>,
): string | null {
  const lines: string[] = [];

  for (const message of userMessages) {
    const line = extractFirstLine(message.text);
    if (line) {
      lines.push(line);
    }
    if (lines.length >= MAX_PROMPTS_FOR_TITLE) {
      break;
    }
  }

  if (lines.length === 0) {
    return null;
  }

  // Collect significant words across all collected lines.
  const significantWords: string[] = [];
  for (const line of lines) {
    for (const word of tokenize(line)) {
      if (STOP_WORDS.has(word.toLowerCase())) continue;
      significantWords.push(capitalise(word));
      if (significantWords.length >= MAX_TITLE_WORDS) break;
    }
    if (significantWords.length >= MAX_TITLE_WORDS) break;
  }

  // If we found enough significant words, join them.
  if (significantWords.length >= 2) {
    return significantWords.join(" ");
  }

  // Fallback: take the first MAX_TITLE_WORDS words verbatim from the first line.
  const fallbackWords = tokenize(lines[0]!).slice(0, MAX_TITLE_WORDS);
  if (fallbackWords.length === 0) {
    return null;
  }
  return fallbackWords.map(capitalise).join(" ");
}

/**
 * Extracts the first non-empty, non-trivial line from a message text.
 * Strips leading markdown heading markers (e.g. "## ") for cleaner titles.
 */
function extractFirstLine(text: string): string | null {
  for (const rawLine of text.split("\n")) {
    // Strip markdown heading markers
    const line = rawLine.replace(/^#{1,6}\s+/, "").trim();
    if (line.length > 0) {
      return line;
    }
  }
  return null;
}

/**
 * Splits text into word tokens, stripping punctuation edges.
 */
function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ""))
    .filter((w) => w.length > 0);
}

/**
 * Capitalise the first letter of a word.
 */
function capitalise(word: string): string {
  if (word.length === 0) return word;
  return word[0]!.toUpperCase() + word.slice(1);
}
