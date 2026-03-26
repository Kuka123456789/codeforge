import { truncateTitle } from "./truncateTitle";

/**
 * Maximum number of recent user prompts to consider when generating an auto-title.
 */
const MAX_PROMPTS_FOR_TITLE = 5;

/**
 * Generates an automatic thread title from the most recent user messages.
 *
 * Strategy:
 * 1. Collect up to {@link MAX_PROMPTS_FOR_TITLE} user messages (most recent first).
 * 2. Extract the first meaningful line from each message.
 * 3. Join them with " | " and truncate to the standard title length.
 *
 * Falls back to the first message snippet if only one prompt exists,
 * matching the existing first-message-as-title behavior.
 */
export function generateAutoTitle(
  userMessages: ReadonlyArray<{ readonly text: string }>,
): string | null {
  const snippets: string[] = [];

  for (const message of userMessages) {
    const line = extractFirstLine(message.text);
    if (line) {
      snippets.push(line);
    }
    if (snippets.length >= MAX_PROMPTS_FOR_TITLE) {
      break;
    }
  }

  if (snippets.length === 0) {
    return null;
  }

  if (snippets.length === 1) {
    return truncateTitle(snippets[0]!);
  }

  // Combine the latest prompts into a condensed title.
  // Use " | " as a separator to visually distinguish topics.
  return truncateTitle(snippets.join(" | "));
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
