import { Schema } from "effect";
import { PositiveInt, ThreadId, TrimmedNonEmptyString } from "./baseSchemas";

const THREAD_SEARCH_MAX_LIMIT = 50;

export const ThreadSearchInput = Schema.Struct({
  query: TrimmedNonEmptyString.check(Schema.isMaxLength(256)),
  limit: PositiveInt.check(Schema.isLessThanOrEqualTo(THREAD_SEARCH_MAX_LIMIT)),
});
export type ThreadSearchInput = typeof ThreadSearchInput.Type;

export const ThreadSearchResultItem = Schema.Struct({
  threadId: ThreadId,
  rank: Schema.Number,
  titleSnippet: Schema.NullOr(Schema.String),
  messageSnippet: Schema.NullOr(Schema.String),
});
export type ThreadSearchResultItem = typeof ThreadSearchResultItem.Type;

export const ThreadSearchResult = Schema.Struct({
  results: Schema.Array(ThreadSearchResultItem),
});
export type ThreadSearchResult = typeof ThreadSearchResult.Type;
