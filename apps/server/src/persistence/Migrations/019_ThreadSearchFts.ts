import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Create FTS5 virtual table for thread search
  yield* sql.unsafe(`
    CREATE VIRTUAL TABLE IF NOT EXISTS thread_search_fts USING fts5(
      thread_id UNINDEXED,
      title,
      first_user_message,
      user_messages,
      tokenize='porter unicode61'
    )
  `);

  // Backfill from existing projection data
  yield* sql.unsafe(`
    INSERT INTO thread_search_fts (thread_id, title, first_user_message, user_messages)
    SELECT
      t.thread_id,
      COALESCE(t.title, ''),
      COALESCE(first_msg.text, ''),
      COALESCE(all_msgs.texts, '')
    FROM projection_threads t
    LEFT JOIN (
      SELECT thread_id, text
      FROM projection_thread_messages
      WHERE role = 'user'
      GROUP BY thread_id
      HAVING created_at = MIN(created_at)
    ) first_msg ON first_msg.thread_id = t.thread_id
    LEFT JOIN (
      SELECT thread_id, GROUP_CONCAT(text, char(10)) AS texts
      FROM (
        SELECT thread_id, text
        FROM projection_thread_messages
        WHERE role = 'user'
        ORDER BY created_at ASC, message_id ASC
      )
      GROUP BY thread_id
    ) all_msgs ON all_msgs.thread_id = t.thread_id
    WHERE t.deleted_at IS NULL
  `);
});
