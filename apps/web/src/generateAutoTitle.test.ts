import { describe, expect, it } from "vitest";

import { generateAutoTitle } from "./generateAutoTitle";

describe("generateAutoTitle", () => {
  it("returns null for empty message list", () => {
    expect(generateAutoTitle([])).toBeNull();
  });

  it("returns null when all messages are blank", () => {
    expect(generateAutoTitle([{ text: "" }, { text: "   " }])).toBeNull();
  });

  it("returns a truncated title from a single message", () => {
    expect(generateAutoTitle([{ text: "Fix the login bug" }])).toBe("Fix the login bug");
  });

  it("joins multiple messages with |", () => {
    const result = generateAutoTitle([
      { text: "Fix login" },
      { text: "Add tests" },
      { text: "Update docs" },
    ]);
    expect(result).toBe("Fix login | Add tests | Update docs");
  });

  it("truncates long combined titles", () => {
    const result = generateAutoTitle([
      { text: "Implement the user authentication system" },
      { text: "Add password reset functionality" },
      { text: "Create email verification flow" },
    ]);
    expect(result!.length).toBeLessThanOrEqual(53); // 50 + "..."
    expect(result).toContain("...");
  });

  it("uses only the first line of each message", () => {
    const result = generateAutoTitle([
      { text: "First line\nSecond line\nThird line" },
      { text: "Another first\nAnother second" },
    ]);
    expect(result).toBe("First line | Another first");
  });

  it("strips markdown heading markers", () => {
    const result = generateAutoTitle([{ text: "## My Heading" }]);
    expect(result).toBe("My Heading");
  });

  it("limits to 5 messages", () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({ text: `M${i + 1}` }));
    const result = generateAutoTitle(messages);
    expect(result).toBe("M1 | M2 | M3 | M4 | M5");
  });

  it("skips blank messages in the sequence", () => {
    const result = generateAutoTitle([{ text: "First" }, { text: "" }, { text: "Third" }]);
    expect(result).toBe("First | Third");
  });
});
