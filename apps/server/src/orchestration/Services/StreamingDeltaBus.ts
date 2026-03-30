/**
 * StreamingDeltaBusService - Sideband for assistant streaming text deltas.
 *
 * Provides a fast path that bypasses the full orchestration pipeline
 * (decider → event store → 10 projectors) for per-token streaming deltas.
 * The accumulated text is still committed through orchestration on turn
 * completion / message finalization.
 *
 * @module StreamingDeltaBusService
 */
import type { StreamingTextDeltaPayload } from "@codeforge/contracts";
import { ServiceMap } from "effect";
import type { Effect, Stream } from "effect";

export interface StreamingDeltaBusShape {
  /** Publish a streaming text delta to all subscribers. */
  readonly publish: (delta: StreamingTextDeltaPayload) => Effect.Effect<void>;

  /** Hot stream of streaming text deltas for WebSocket broadcast. */
  readonly stream: Stream.Stream<StreamingTextDeltaPayload>;
}

export class StreamingDeltaBusService extends ServiceMap.Service<
  StreamingDeltaBusService,
  StreamingDeltaBusShape
>()("codeforge/orchestration/Services/StreamingDeltaBus/StreamingDeltaBusService") {}
