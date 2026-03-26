import * as SqlClient from "effect/unstable/sql/SqlClient";
import { Effect, Layer } from "effect";

import { toPersistenceSqlError } from "../Errors.ts";
import { ThreadSearchIndex, type ThreadSearchIndexShape } from "../Services/ThreadSearchIndex.ts";

/** Max chars of concatenated user messages to store per thread in the FTS index. */
const USER_MESSAGES_MAX_LENGTH = 10_000;

/**
 * Preprocess a user search query into FTS5 MATCH syntax.
 *
 * 1. Strip FTS5 special characters to prevent syntax errors
 * 2. Split on whitespace into tokens
 * 3. Append `*` to each token for prefix matching
 * 4. Join with space (FTS5 implicit AND)
 *
 * Examples:
 *   "chat search"  -> "chat* search*"
 *   "logo"         -> "logo*"
 *   "fix bug #123" -> "fix* bug* 123*"
 */
export function preprocessSearchQuery(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/[""*(){}[\]+\-:^~<>\\|!@#$%&=;,./]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length === 0) {
    return null;
  }

  return cleaned
    .split(" ")
    .filter((token) => token.length > 0)
    .map((token) => `${token}*`)
    .join(" ");
}

const makeThreadSearchIndex = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsert: ThreadSearchIndexShape["upsert"] = (input) =>
    Effect.gen(function* () {
      const truncatedMessages = input.userMessages.slice(0, USER_MESSAGES_MAX_LENGTH);

      yield* sql.unsafe(`DELETE FROM thread_search_fts WHERE thread_id = ?`, [input.threadId]);
      yield* sql.unsafe(
        `INSERT INTO thread_search_fts (thread_id, title, first_user_message, user_messages)
         VALUES (?, ?, ?, ?)`,
        [input.threadId, input.title, input.firstUserMessage, truncatedMessages],
      );
    }).pipe(Effect.mapError(toPersistenceSqlError("ThreadSearchIndex.upsert:query")));

  const deleteByThreadId: ThreadSearchIndexShape["deleteByThreadId"] = (input) =>
    sql
      .unsafe(`DELETE FROM thread_search_fts WHERE thread_id = ?`, [input.threadId])
      .pipe(
        Effect.mapError(toPersistenceSqlError("ThreadSearchIndex.deleteByThreadId:query")),
        Effect.asVoid,
      );

  const search: ThreadSearchIndexShape["search"] = (input) =>
    Effect.gen(function* () {
      const matchExpr = preprocessSearchQuery(input.query);
      if (matchExpr === null) {
        return [];
      }

      const rows = yield* sql.unsafe(
        `SELECT
           thread_id AS "threadId",
           rank AS "rank",
           snippet(thread_search_fts, 1, '<mark>', '</mark>', '...', 32) AS "titleSnippet",
           snippet(thread_search_fts, 3, '<mark>', '</mark>', '...', 48) AS "messageSnippet"
         FROM thread_search_fts
         WHERE thread_search_fts MATCH ?
         ORDER BY bm25(thread_search_fts, 0.0, 10.0, 5.0, 1.0)
         LIMIT ?`,
        [matchExpr, input.limit],
      );

      return rows as unknown as ReadonlyArray<{
        threadId: string;
        rank: number;
        titleSnippet: string | null;
        messageSnippet: string | null;
      }>;
    }).pipe(
      Effect.mapError(toPersistenceSqlError("ThreadSearchIndex.search:query")),
      // If the FTS5 query is malformed despite preprocessing, return empty results
      Effect.catch(() => Effect.succeed([] as const)),
    );

  return { upsert, deleteByThreadId, search } satisfies ThreadSearchIndexShape;
});

export const ThreadSearchIndexLive = Layer.effect(ThreadSearchIndex, makeThreadSearchIndex);
