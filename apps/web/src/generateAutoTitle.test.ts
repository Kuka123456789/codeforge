import { describe, expect, it } from "vitest";

import { generateAutoTitle } from "./generateAutoTitle";

describe("generateAutoTitle", () => {
  it("returns null for empty message list", () => {
    expect(generateAutoTitle([])).toBeNull();
  });

  it("returns null when all messages are blank", () => {
    expect(generateAutoTitle([{ text: "" }, { text: "   " }])).toBeNull();
  });

  it("produces a short title from a single message", () => {
    // "Fix" is significant, "the" is a stop word, "login" and "bug" are significant
    expect(generateAutoTitle([{ text: "Fix the login bug" }])).toBe("Fix Login Bug");
  });

  it("limits to at most 4 words", () => {
    const result = generateAutoTitle([
      { text: "Implement the user authentication system with OAuth" },
    ]);
    const wordCount = result!.split(" ").length;
    expect(wordCount).toBeLessThanOrEqual(4);
  });

  it("pulls significant words from multiple messages", () => {
    const result = generateAutoTitle([
      { text: "Fix login" },
      { text: "Add tests" },
      { text: "Update docs" },
    ]);
    // "Fix", "Login", "Add", "Tests" — 4 significant words from across messages
    expect(result).toBe("Fix Login Add Tests");
  });

  it("strips markdown heading markers", () => {
    const result = generateAutoTitle([{ text: "## Refactor database layer" }]);
    expect(result).toBe("Refactor Database Layer");
  });

  it("uses only the first line of each message", () => {
    const result = generateAutoTitle([
      { text: "Refactor auth\nThis is detailed explanation\nMore details" },
    ]);
    expect(result).toBe("Refactor Auth");
  });

  it("skips blank messages in the sequence", () => {
    const result = generateAutoTitle([
      { text: "Deploy" },
      { text: "" },
      { text: "Staging server" },
    ]);
    expect(result).toBe("Deploy Staging Server");
  });

  it("falls back to verbatim words when all words are stop words", () => {
    // "do it now" — all stop words, so fallback to first 4 verbatim words
    const result = generateAutoTitle([{ text: "do it now" }]);
    expect(result).toBe("Do It Now");
  });

  it("capitalises each word", () => {
    const result = generateAutoTitle([{ text: "debug websocket reconnection" }]);
    expect(result).toBe("Debug Websocket Reconnection");
  });

  it("strips punctuation from word edges", () => {
    const result = generateAutoTitle([{ text: "(fix) broken, endpoint!" }]);
    // "fix", "broken", "endpoint" are significant
    expect(result).toBe("Fix Broken Endpoint");
  });

  it("considers up to 5 messages for word extraction", () => {
    // Each message contributes 1 significant word
    const messages = Array.from({ length: 10 }, (_, i) => ({ text: `task${i + 1}` }));
    const result = generateAutoTitle(messages);
    // Only first 4 significant words used (MAX_TITLE_WORDS = 4)
    expect(result).toBe("Task1 Task2 Task3 Task4");
  });
});
