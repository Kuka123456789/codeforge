import { ThreadId, type ThreadSearchResultItem } from "@codeforge/contracts";
import { Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const ThreadSearchUpsertInput = Schema.Struct({
  threadId: ThreadId,
  title: Schema.String,
  firstUserMessage: Schema.String,
  userMessages: Schema.String,
});
export type ThreadSearchUpsertInput = typeof ThreadSearchUpsertInput.Type;

export const ThreadSearchDeleteInput = Schema.Struct({
  threadId: ThreadId,
});
export type ThreadSearchDeleteInput = typeof ThreadSearchDeleteInput.Type;

export const ThreadSearchQueryInput = Schema.Struct({
  query: Schema.String,
  limit: Schema.Number,
});
export type ThreadSearchQueryInput = typeof ThreadSearchQueryInput.Type;

/**
 * ThreadSearchIndexShape - Service API for FTS5-backed thread search.
 */
export interface ThreadSearchIndexShape {
  /**
   * Upsert a thread into the FTS index.
   *
   * Deletes any existing entry then inserts a fresh row.
   * This handles the fact that FTS5 tables don't support UPDATE.
   */
  readonly upsert: (
    input: ThreadSearchUpsertInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;

  /**
   * Remove a thread from the FTS index.
   */
  readonly deleteByThreadId: (
    input: ThreadSearchDeleteInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;

  /**
   * Search threads using FTS5 full-text matching with BM25 ranking.
   *
   * Returns results ordered by relevance with optional snippet highlighting.
   */
  readonly search: (
    input: ThreadSearchQueryInput,
  ) => Effect.Effect<ReadonlyArray<ThreadSearchResultItem>, ProjectionRepositoryError>;
}

/**
 * ThreadSearchIndex - Service tag for FTS5 thread search persistence.
 */
export class ThreadSearchIndex extends ServiceMap.Service<
  ThreadSearchIndex,
  ThreadSearchIndexShape
>()("codeforge/persistence/Services/ThreadSearchIndex/ThreadSearchIndex") {}
